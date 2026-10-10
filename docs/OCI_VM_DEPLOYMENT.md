# Arivu production on OCI — step-by-step

Follow the sections in order. Stop at the end of each section until its check passes.

The Vue app stays on Vercel at `app.arivusystems.com`. This runbook does not move it.

You do not change application code for a second API or a second Worker. OCI instance pools launch more copies of the same API process and the same Worker process. MongoDB and Redis stay single VMs. They are not in a pool.

This path does not use Docker or Kubernetes.

API and Worker both require **Node.js 22.12.0 or newer, on the Node 22 line**. Node.js 22.0.0 through 22.11.x is not acceptable. `jwks-rsa@4.1.0` (pulled in by `firebase-admin`) declares `^22.12.0` on that line.

Replace every `<…>` placeholder before you run a command or save a secret. Do not commit `/etc/arivu/*.env`, Vault secret contents, or private keys.

## Recommended order

Create the compartment first (section 0). Then:

1. OCI network
2. Bastion
3. MongoDB 8 replica set `rs0` (initiate the set before any API or Worker starts)
4. Redis
5. Object Storage
6. Vault/secrets
7. API pool size 1
8. Worker pool size 1
9. Load balancer
10. DNS
11. Production smoke tests
12. Legacy quote/invoice migration
13. Increase API pool to 2
14. Increase Worker pool to 2
15. Consider autoscaling later

Do not raise the API pool above 1 until step 12 has finished. `server/.env.production.example` is not the complete production environment. Paste the Vault files in section 8.

## What you are building

| Order | What you create in OCI | How many | Public internet |
|------:|------------------------|----------|-----------------|
| 1 | Compartment `arivu-production` | 1 | — |
| 2 | Network (VCN, subnets, NAT, service gateway) | 1 | — |
| 3 | Bastion | 1 | You connect through Oracle. Port 22 is not open to the world. |
| 4 | MongoDB VM | 1 | Private |
| 5 | Redis VM | 1 | Private |
| 6 | Object Storage bucket | 1 | Private bucket |
| 7 | Vault secrets for the API env, the Worker env, and the git deploy key | 3 | — |
| 8 | API instance pool | Start at 1 instance. Grow to 2 only after smoke tests and the legacy quote/invoice migration. | Private. The load balancer calls port 5000. |
| 9 | Worker instance pool | Start at 1 instance. Grow to 2 after the API pool is at 2. | Private. No load balancer. |
| 10 | Load balancer | 1 | HTTPS 443 |
| 11 | DNS `api.arivusystems.com` | 1 | Points at the load balancer |

An instance pool is a group that keeps a chosen number of identical VMs running. The template for those VMs is an instance configuration. Adding API #2 or Worker #2 means raising that number from 1 to 2. You do not create those VMs by hand.

## Words used in the console

| Word | Meaning |
|------|---------|
| Region | The data-center area. Pick one, for example `ap-mumbai-1`, and create every resource in it. |
| Compartment | A folder for resources. Everything in this runbook goes in `arivu-production`. |
| VCN | Your private network. |
| Subnet | A slice of that network. Public subnet: load balancer and bastion. Private subnet: MongoDB, Redis, API, Worker. |
| NSG | A firewall attached to a VM or load balancer. |
| Bastion | Oracle’s service that lets you SSH to a private VM without a public IP. |
| Instance | One VM. |
| Instance configuration | The template (shape, image, startup script) used to create instances. |
| Instance pool | Keeps N instances from that template running, and can register API instances with the load balancer. |
| Vault | Where the env files and the git key are stored. A new VM reads them on first boot. |
| Cloud-init | The startup script pasted into the instance configuration. It runs once, as root, the first time a VM boots. |

The compartment dropdown at the top of list pages hides resources that live in another compartment. If a list is empty, set that dropdown to `arivu-production` or to the parent that contains it.

Open any service from the navigation menu (the icon at the top left).

## Values to fill in before you start

Write these down as you create them. Later steps refer to them by these names.

| Name | Example | Where it comes from |
|------|---------|---------------------|
| Region | `ap-mumbai-1` | You choose it in section 1 |
| Compartment | `arivu-production` | Section 1 |
| API env secret OCID | `ocid1.vaultsecret.oc1...` | Section 7 |
| Worker env secret OCID | `ocid1.vaultsecret.oc1...` | Section 7 |
| Git deploy key secret OCID | `ocid1.vaultsecret.oc1...` | Section 7 |
| Git SSH URL | `git@github.com:<org>/<repo>.git` | Your git host |
| Release tag | `v1.2.3` | The tag you are deploying |

Use an AMD shape, not Ampere (Arm). The API installs the amd64 Chrome package.

| VM | Shape | Boot disk | Extra disk |
|----|-------|-----------|------------|
| MongoDB | Flexible AMD, 2 OCPU, 16 GB | 50 GB | 200 GB block volume at `/var/lib/mongodb` |
| Redis | Flexible AMD, 1 OCPU, 8 GB | 50 GB | none |
| Each API instance | Flexible AMD, 2 OCPU, 8 GB | 50 GB | none |
| Each Worker instance | Flexible AMD, 2 OCPU, 8 GB | 50 GB | none |

OS image for every VM: **Canonical Ubuntu 24.04**.

## 0. Compartment and SSH key

1. Navigation menu → **Identity & Security** → **Compartments** → **Create Compartment**.
2. Name: `arivu-production`. Parent: the root compartment. Create.
3. On your laptop, create an SSH key if you do not already have one:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/arivu_oci -C "arivu-oci"
```

`~/.ssh/arivu_oci.pub` is the public key you will paste into every VM. `~/.ssh/arivu_oci` is the private key. It stays on your laptop.

## 1. Network

1. In the console header, select the region, for example **India West (Mumbai)**.
2. Navigation menu → **Networking** → **Virtual cloud networks**.
3. Confirm the compartment is `arivu-production`.
4. **Start VCN Wizard** → **Create VCN with Internet Connectivity** → **Start VCN Wizard**.
5. Name: `arivu-vcn`. Compartment: `arivu-production`.
6. VCN CIDR: `10.0.0.0/16`.
7. Public subnet CIDR: `10.0.0.0/24`. Private subnet CIDR: `10.0.1.0/24`.
8. Leave the wizard’s DNS and gateway checkboxes on. **Next** → **Create**.

The wizard creates the VCN, one public subnet, one private subnet, an internet gateway, a NAT gateway, and a service gateway. Private VMs use the NAT gateway to download packages and call email and AMDS. They use the service gateway to reach Object Storage.

Confirm the private subnet route table has both of these routes. Open the VCN → **Route Tables** → the private route table:

| Destination | Target |
|-------------|--------|
| `0.0.0.0/0` | NAT gateway |
| `All <region> Services in Oracle Services Network` | Service gateway |

The public route table has `0.0.0.0/0` → internet gateway.

### Network security groups

Open the VCN → **Network Security Groups** → **Create Network Security Group**. Create five groups in `arivu-production`. Add the rules after each group exists (a rule can name another group only after that group exists).

| NSG | Ingress |
|-----|---------|
| `nsg-bastion` | none from the internet |
| `nsg-mongo` | TCP 22 from `10.0.0.0/24`. TCP 27017 from `nsg-api` and `nsg-worker`. |
| `nsg-redis` | TCP 22 from `10.0.0.0/24`. TCP 6379 from `nsg-api` and `nsg-worker`. |
| `nsg-api` | TCP 22 from `10.0.0.0/24`. TCP 5000 from `nsg-lb`. |
| `nsg-worker` | TCP 22 from `10.0.0.0/24`. |
| `nsg-lb` | TCP 443 from `0.0.0.0/0`. |

`10.0.0.0/24` is the public subnet, where the bastion will sit. That is what allows a bastion session to reach SSH. It does not open SSH to the internet.

For each rule: open the NSG → **Security Rules** → **Add Rule** → Direction **Ingress** → Source type **CIDR** or **Network Security Group** → IP protocol **TCP** → destination port as in the table → **Add**.

Egress for `nsg-api` and `nsg-worker`: TCP 27017 to `nsg-mongo`, TCP 6379 to `nsg-redis`, TCP 443 to `0.0.0.0/0`. The default egress rule of “all protocols to `0.0.0.0/0`” also works. Leave that default if it is already there.

### Check

- VCN `arivu-vcn` is in the region you chose.
- Private subnet `10.0.1.0/24` has a NAT route and a service-gateway route.
- The six NSGs exist.

## 2. Bastion

1. Navigation menu → **Identity & Security** → **Bastion** → **Create bastion**.
2. Name: `arivu-bastion`. Compartment: `arivu-production`.
3. Target VCN: `arivu-vcn`. Target subnet: the **public** subnet `10.0.0.0/24`.
4. CIDR block allowlist: your current public IP with `/32`, for example `203.0.113.10/32`. This is who may open a session. It is not the VM’s firewall.
5. Create.

You will create a session later, after a VM exists. A session lasts at most 3 hours. When it expires, create another one. The VM keeps running.

### Open SSH to a private VM

1. Bastion details → **Create session**.
2. Session type: **Managed SSH session**.
3. Session name: anything, for example `mongo`.
4. Username: `ubuntu`.
5. Compute instance: the private VM, or paste its private IP (`10.0.1.x`).
6. SSH port: `22`.
7. Upload `~/.ssh/arivu_oci.pub` if the form asks for the public key, and point your SSH client at `~/.ssh/arivu_oci`.
8. Create session. When the state is **Active**, open the session menu and copy the SSH command. Run that command on your laptop.

## 3. MongoDB VM

One VM. Do not put MongoDB in an instance pool.

Private IP example used below: `10.0.1.10`. Use the private IP the console shows if it differs, and use that IP in `mongod.conf` and in `MONGODB_URI`.

### Create the VM

1. Navigation menu → **Compute** → **Instances** → **Create instance**.
2. Name: `arivu-mongo`. Compartment: `arivu-production`.
3. Placement: the only availability domain, unless the region lists more than one. Pick any fault domain.
4. Image: **Canonical Ubuntu 24.04**.
5. Shape: **Change shape** → **Ampere** is the wrong family. Choose an AMD flexible shape. Set **2 OCPU** and **16 GB** memory.
6. Networking: VCN `arivu-vcn`, subnet the **private** subnet. Select **Do not assign a public IPv4 address**.
7. Under advanced networking, or the NSG control on the same form, attach `nsg-mongo` and clear the default security list if the form lets you leave only the NSG. If the form requires a security list as well, leave the default private security list attached. NSG and security-list rules are combined: a packet is allowed when either one allows it. Remove any security-list rule that allows SSH from `0.0.0.0/0` on this subnet.
8. Add SSH key: paste `~/.ssh/arivu_oci.pub`.
9. Boot volume: 50 GB.
10. Create. Wait until the state is **Running**. Copy the private IP.

### Data disk

1. Navigation menu → **Storage** → **Block Volumes** → **Create Block Volume**.
2. Name: `arivu-mongo-data`. Compartment: `arivu-production`. Size: 200 GB. Same availability domain as the VM. Create.
3. Block volume details → **Attached Instances** → **Attach to Instance** → `arivu-mongo`.
4. Attachment type: **Paravirtualized**. Device path: leave the default. Attach.

Open a bastion session to this VM, then:

```bash
lsblk
sudo mkfs.xfs /dev/oracleoci/oraclevdb
sudo mkdir -p /var/lib/mongodb
echo '/dev/oracleoci/oraclevdb /var/lib/mongodb xfs defaults,noatime 0 2' | sudo tee -a /etc/fstab
sudo mount -a
```

Confirm the device name with `lsblk` before `mkfs`. The new disk has no mount and is about 200 GB. A wrong device wipes the boot disk.

### Install

```bash
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-ntp true
sudo apt install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo chown -R mongodb:mongodb /var/lib/mongodb
```

### Config

`/etc/mongod.conf` must set the private IP, authentication, and a single-member replica set. `retryWrites` in the app requires a replica set even with one member.

```yaml
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1,10.0.1.10
security:
  authorization: enabled
replication:
  replSetName: rs0
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
```

```bash
sudo systemctl enable --now mongod
```

### Users and replica set

Connect once on localhost before the replica set is initiated (localhost exception still applies on a fresh install):

```bash
mongosh
```

```javascript
use admin
db.createUser({
  user: "arivu",
  pwd: passwordPrompt(),
  roles: [
    { role: "readWriteAnyDatabase", db: "admin" },
    { role: "dbAdminAnyDatabase", db: "admin" }
  ]
})
rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "10.0.1.10:27017" }] })
```

`readWriteAnyDatabase` is required because the API uses `arivu_master` plus one database per tenant. The replica-set host must be the private IP the API will dial, not `localhost`.

`rs.initiate` for `rs0` must succeed before you start the API or the Worker. `retryWrites=true` fails on a standalone `mongod`. Do not create the API or Worker pools until `rs.status()` shows `rs0` / `PRIMARY`.

Exit, then confirm auth and the set:

```bash
mongosh "mongodb://arivu@10.0.1.10:27017/admin?authSource=admin" --quiet --eval 'rs.status().ok'
```

Expected: `1`.

Application URI. The query string must include `authSource=admin`, `replicaSet=rs0`, and `retryWrites=true`. Password is URL-encoded. `<PRIVATE_MONGO_IP>` is the MongoDB VM private IP (`10.0.1.10` in the example above):

```text
mongodb://arivu:<PASSWORD>@<PRIVATE_MONGO_IP>:27017/arivu_master?authSource=admin&replicaSet=rs0&retryWrites=true
```

### Backup

Do both. Volume backups are the fast restore. `mongodump` is the logical copy you can move off the VM.

1. On the block volume `arivu-mongo-data` → **Backup Policies**. Assign a daily policy and keep at least 14 days. Do this before you load data.
2. After the bucket exists (section 5) and the MongoDB instance principal exists (section 6), return here and install the dump cron. Tag this VM `arivu.role` = `mongo` before the first run. The cron can write only to `backups/mongo/` in that bucket.

```bash
sudo mkdir -p /var/backups/mongodb
sudo tee /usr/local/bin/arivu-mongo-backup.sh >/dev/null <<'EOF'
#!/bin/bash
set -euo pipefail
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="/var/backups/mongodb/arivu-${STAMP}.archive.gz"
mongodump --uri="$MONGODB_URI" --archive="$OUT" --gzip
oci os object put --bucket-name "$BUCKET" --name "backups/mongo/arivu-${STAMP}.archive.gz" --file "$OUT" --auth instance_principal
find /var/backups/mongodb -type f -mtime +2 -delete
EOF
sudo chmod 750 /usr/local/bin/arivu-mongo-backup.sh
```

Put `MONGODB_URI` and `BUCKET` in `/etc/arivu/mongo-backup.env` (`chmod 600`). Cron as root, daily:

```cron
15 2 * * * . /etc/arivu/mongo-backup.env && /usr/local/bin/arivu-mongo-backup.sh >> /var/log/arivu-mongo-backup.log 2>&1
```

The `oci` command in that script needs the CLI and a dynamic group that matches only `arivu-mongo`. Create that group the same way as section 6, with a defined tag `arivu.role=mongo` on this VM, and a policy that allows `manage objects` in `arivu-production` where `target.bucket.name='arivu-production'` and the object name is under `backups/mongo/`. Install the CLI on this VM with:

```bash
bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install.sh)" -- --accept-all-defaults
```

Restore drill once before go-live: `mongorestore --uri=... --archive=... --gzip --drop` onto a throwaway database, or restore the block volume to a new VM and run `rs.status()`.

### Check before Redis

- `ss -lnt | grep 27017` shows `10.0.1.10`, not `0.0.0.0`.
- Unauthenticated `mongosh mongodb://10.0.1.10:27017` fails.
- `rs.status()` shows `rs0` / `PRIMARY`.
- A backup policy is attached to the data volume.

## 4. Redis VM

One VM. Do not put Redis in an instance pool.

Private IP example: `10.0.1.20`.

### Create the VM

Same form as MongoDB, with these differences:

- Name: `arivu-redis`.
- Shape: AMD flexible, **1 OCPU**, **8 GB**.
- NSG: `nsg-redis`.
- Private subnet, no public IPv4 address.
- Same SSH public key.
- Boot volume 50 GB. No extra block volume.

Bastion in, then:

```bash
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-ntp true
sudo apt install -y redis-server
```

Edit `/etc/redis/redis.conf`:

```conf
bind 127.0.0.1 10.0.1.20
protected-mode yes
port 6379
requirepass <long-random-password>
appendonly yes
appendfsync everysec
maxmemory 6gb
maxmemory-policy noeviction
supervised systemd
```

`maxmemory` stays under RAM (8 GB VM → about 6 GB). `noeviction` makes Redis refuse writes when full so Bull jobs are not deleted. Alert on `used_memory` before it hits that cap. AOF is the queue durability across a Redis restart.

```bash
sudo systemctl enable --now redis-server
redis-cli -a '<password>' CONFIG GET maxmemory-policy
redis-cli -a '<password>' CONFIG GET appendonly
redis-cli -a '<password>' INFO persistence | grep aof_enabled
```

Expected: `noeviction`, `appendonly` `yes`, `aof_enabled:1`.

Application URL (password URL-encoded). API and Worker must use this same value as `REDIS_URL`:

```text
redis://:<password>@10.0.1.20:6379
```

`REDIS_HEALTH_BLOCKS_READY=true` is required on the API. `GET /health/ready` stays 503 while Redis is down or `REDIS_URL` is missing. The Worker exits at startup if `REDIS_URL` and `REDIS_HOST` are both unset.

### Check before Object Storage

- From this VM, `redis-cli -h 10.0.1.20 -a '<password>' PING` returns `PONG`.
- A client without the password gets `NOAUTH`.
- Port 6379 is not reachable from the public internet.

## 5. Object Storage

1. Navigation menu → **Storage** → **Object Storage & Archive Storage** → **Buckets** → **Create Bucket**.
2. Name: `arivu-production`. Compartment: `arivu-production`. Default storage tier. **Private**. Same region as the VMs. Create.
3. Open the bucket. Copy the **Namespace** from the bucket details. You will put it in `STORAGE_ENDPOINT`.
4. Navigation menu → **Identity & Security** → **Domains** → **Default** → **Users** → **Create user**. Name: `arivu-storage`. This user is only for the S3-compatible storage keys. It does not log in to the console.
5. Open that user → **Customer secret keys** → **Generate secret key**. Name: `arivu-production`.
   - Access key → `STORAGE_ACCESS_KEY`
   - Secret key → `STORAGE_SECRET_KEY` (shown once; copy it now)
6. Navigation menu → **Identity & Security** → **Policies** → **Create Policy**. Name: `arivu-storage-objects`. Compartment: `arivu-production`. Enable the manual editor and paste:

```text
Allow group arivu-storage-group to manage objects in compartment arivu-production where target.bucket.name = 'arivu-production'
```

Put `arivu-storage` in a group `arivu-storage-group` first (Domains → Groups → Create group → add the user). Do not grant this user tenancy admin.

```text
IMPORT_STORAGE_DRIVER=oci
STORAGE_ENDPOINT=https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
STORAGE_REGION=<region>
STORAGE_BUCKET=arivu-production
STORAGE_ACCESS_KEY=<customer-secret-access-key>
STORAGE_SECRET_KEY=<customer-secret-key>
STORAGE_FORCE_PATH_STYLE=true
```

Both the API Vault secret and the Worker Vault secret must contain this whole block. `STORAGE_FORCE_PATH_STYLE=true` is required. The app turns on path-style requests only when that value is the string `true`. OCI’s S3-compatible endpoint does not work with the default (path-style off).

`server/.env.production.example` is not the complete production environment. It omits `STORAGE_FORCE_PATH_STYLE`. Do not paste that file into Vault. Use section 8.

Smoke test from a laptop that has the keys:

```bash
aws s3api put-object \
  --endpoint-url "https://<namespace>.compat.objectstorage.<region>.oraclecloud.com" \
  --region "<region>" \
  --bucket arivu-production \
  --key healthchecks/oci-put.txt \
  --body ./oci-put.txt
```

Then delete `healthchecks/oci-put.txt`. Return to the MongoDB VM and install the `mongodump` cron now that the bucket exists.

## 6. Vault, tag, and instance principal

API and Worker VMs read their env from Vault on first boot. The startup script contains secret OCIDs, not the secret values. Anyone who can open the instance configuration can see the script. They still cannot read a secret without the policy below.

### Tag

1. Navigation menu → **Identity & Security** → **Tag Namespaces** → **Create Namespace Definition**.
2. Name: `arivu`. Compartment: `arivu-production`. Create.
3. Open the namespace → **Create Tag Key Definition**. Name: `role`. Leave the value unconstrained. Create.

You will set this tag to `api`, `worker`, or `mongo` on the matching VMs.

### Vault and master key

1. Navigation menu → **Identity & Security** → **Vault** → **Create Vault**.
2. Name: `arivu-vault`. Compartment: `arivu-production`. Make it a private vault. Create. Wait until it is **Active**.
3. Open the vault → **Master Encryption Keys** → **Create Key**.
4. Name: `arivu-secrets`. Protection mode: Software. Key shape: AES, length 256. Create. Wait until it is **Enabled**.

### Three secrets

Open the vault → **Secrets** → **Create Secret**. Paste the raw text. Do not base64-encode it yourself. The console does that.

| Secret name | Contents |
|-------------|----------|
| `arivu-api-env` | The API env file in section 8, complete, including secrets |
| `arivu-worker-env` | The Worker env file in section 8 |
| `arivu-git-deploy-key` | The private half of a read-only git deploy key, including the `BEGIN` and `END` lines |

On the git host, add the public half of that key as a deploy key with read access to the repo. Store the private half only in `arivu-git-deploy-key`.

After each secret is **Active**, open it and copy its OCID (`ocid1.vaultsecret...`).

### Dynamic group

Instance principals are how a VM proves its identity without an API key on disk.

Create two dynamic groups. Navigation menu → **Identity & Security** → **Domains** → **Default** → **Dynamic groups** → **Create dynamic group**. The tag namespace and values are case-sensitive.

| Name | Matching rule |
|------|----------------|
| `arivu-app-instances` | `Any {tag.arivu.role.value = 'api', tag.arivu.role.value = 'worker'}` |
| `arivu-mongo-backup` | `tag.arivu.role.value = 'mongo'` |

On the MongoDB VM, open the instance → **Tags** → add defined tag `arivu.role` = `mongo`. The API and Worker tags are set on their instance configurations in sections 9 and 10.

### Policy

1. Navigation menu → **Identity & Security** → **Policies** → **Create Policy**.
2. Name: `arivu-instance-principals`. Compartment: the **root** compartment (dynamic-group policies are attached at root).
3. Manual editor:

```text
Allow dynamic-group arivu-app-instances to read secret-bundles in compartment arivu-production
Allow dynamic-group arivu-mongo-backup to manage objects in compartment arivu-production where all {target.bucket.name = 'arivu-production', target.object.name = 'backups/mongo/*'}
```

4. Create.

The API and Worker can read Vault secrets. They cannot use this policy to write backups. The MongoDB VM can write `backups/mongo/*` and cannot read the API env secret.

If the console reports that a group name must include the identity domain, use the name the error shows, often `'Default'/'arivu-app-instances'`. Use the same form for `arivu-storage-group` in section 5 if that policy fails to save.

### Check

- Three secrets are **Active** and you have their OCIDs.
- Tag key `arivu.role` exists.
- The dynamic group and the root policy exist.

## 7. Startup script

Both pools run this script once, on first boot. The API configuration and the Worker configuration differ only in the configuration block at the top.

What the script does:

1. Installs Node.js 22.12.0 or newer (Node 22 line) and, on the API only, Google Chrome. Bootstrap exits if `node -p "process.versions.node"` is below `22.12.0` or is not Node 22.
2. Creates the `arivu` user.
3. Reads the env file and the git key from Vault.
4. Clones the release tag to `/opt/arivu/src` and runs `npm ci --omit=dev`.
5. Installs and starts `arivu-api` or `arivu-worker`.

Create the script on your laptop as `arivu-cloud-init.yaml`. Fill in the configuration block before you paste it into OCI.

```yaml
#cloud-config
write_files:
  - path: /usr/local/sbin/arivu-bootstrap.sh
    permissions: "0700"
    content: |
      #!/bin/bash
      set -euo pipefail
      exec > >(tee -a /var/log/arivu-bootstrap.log) 2>&1

      ROLE="api"
      RELEASE_TAG="<release-tag>"
      REPO_URL="git@github.com:<org>/<repo>.git"
      REGION="<region>"
      API_ENV_SECRET_OCID="<ocid1.vaultsecret...>"
      WORKER_ENV_SECRET_OCID="<ocid1.vaultsecret...>"
      GIT_KEY_SECRET_OCID="<ocid1.vaultsecret...>"

      export DEBIAN_FRONTEND=noninteractive
      apt-get update
      apt-get install -y build-essential python3 ca-certificates curl gnupg git

      node_ok=0
      if command -v node >/dev/null 2>&1; then
        if node -e 'const p=process.versions.node.split(".").map(Number); process.exit(p[0]===22 && (p[1]>12 || (p[1]===12 && p[2]>=0)) ? 0 : 1)'; then
          node_ok=1
        fi
      fi
      if [ "$node_ok" -ne 1 ]; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt-get install -y nodejs
      fi
      INSTALLED_NODE="$(node -p "process.versions.node")"
      echo "Node.js ${INSTALLED_NODE}"
      node -e 'const p=process.versions.node.split(".").map(Number); if (!(p[0]===22 && (p[1]>12 || (p[1]===12 && p[2]>=0)))) { console.error("Bootstrap failed: Node.js "+process.versions.node+" is not 22.12.0 or newer on the Node 22 line"); process.exit(1); }'

      if [ "$ROLE" = "api" ] && ! command -v google-chrome-stable >/dev/null 2>&1; then
        curl -fsSL -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
        apt-get install -y /tmp/chrome.deb fonts-liberation fonts-noto-core
        rm -f /tmp/chrome.deb
      fi

      if [ ! -x /root/bin/oci ]; then
        bash -c "$(curl -fsSL https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install.sh)" -- --accept-all-defaults
      fi

      id -u arivu >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/arivu --shell /usr/sbin/nologin arivu
      install -d -o arivu -g arivu -m 0750 /opt/arivu /etc/arivu
      install -d -o arivu -g arivu -m 0700 /opt/arivu/.ssh

      fetch_secret() {
        local secret_id="$1" dest="$2" owner="$3" group="$4" mode="$5" tmp
        tmp="$(mktemp)"
        /root/bin/oci secrets secret-bundle get \
          --auth instance_principal \
          --region "$REGION" \
          --secret-id "$secret_id" \
          --query 'data."secret-bundle-content".content' \
          --raw-output | base64 -d > "$tmp"
        install -o "$owner" -g "$group" -m "$mode" "$tmp" "$dest"
        rm -f "$tmp"
      }

      fetch_secret "$GIT_KEY_SECRET_OCID" /opt/arivu/.ssh/id_ed25519 arivu arivu 600
      ssh-keyscan -t ed25519 github.com > /opt/arivu/.ssh/known_hosts
      chown arivu:arivu /opt/arivu/.ssh/known_hosts
      chmod 644 /opt/arivu/.ssh/known_hosts

      if [ "$ROLE" = "api" ]; then
        fetch_secret "$API_ENV_SECRET_OCID" /etc/arivu/api.env root arivu 640
        UNIT_NAME="arivu-api"
        UNIT_DESC="Arivu API"
        UNIT_EXEC="/usr/bin/node server.js"
        ENV_FILE="/etc/arivu/api.env"
      else
        fetch_secret "$WORKER_ENV_SECRET_OCID" /etc/arivu/worker.env root arivu 640
        UNIT_NAME="arivu-worker"
        UNIT_DESC="Arivu worker"
        UNIT_EXEC="/usr/bin/node worker.js"
        ENV_FILE="/etc/arivu/worker.env"
      fi

      install -d -o arivu -g arivu -m 0755 /opt/arivu/src
      sudo -u arivu HOME=/opt/arivu GIT_SSH_COMMAND="ssh -i /opt/arivu/.ssh/id_ed25519 -o IdentitiesOnly=yes" \
        git clone --branch "$RELEASE_TAG" --depth 1 "$REPO_URL" /opt/arivu/src
      sudo -u arivu HOME=/opt/arivu NPM_CONFIG_CACHE=/opt/arivu/.npm \
        npm ci --omit=dev --prefix /opt/arivu/src/server

      cat > "/etc/systemd/system/${UNIT_NAME}.service" <<EOF
      [Unit]
      Description=${UNIT_DESC}
      After=network-online.target
      Wants=network-online.target

      [Service]
      Type=simple
      User=arivu
      Group=arivu
      WorkingDirectory=/opt/arivu/src/server
      EnvironmentFile=${ENV_FILE}
      ExecStart=${UNIT_EXEC}
      Restart=on-failure
      RestartSec=5
      LimitNOFILE=65535
      NoNewPrivileges=true

      [Install]
      WantedBy=multi-user.target
      EOF
      sed -i 's/^[[:space:]]*//' "/etc/systemd/system/${UNIT_NAME}.service"

      systemctl daemon-reload
      systemctl enable --now "$UNIT_NAME"
      touch /var/lib/arivu-bootstrap-ok
runcmd:
  - [/usr/local/sbin/arivu-bootstrap.sh]
```

Make a second copy for the Worker. In that copy set `ROLE="worker"` and leave the other lines the same. If the git host is not GitHub, change `ssh-keyscan` and `REPO_URL` to that host.

`git clone` of a tag needs the tag to exist on the remote before you create the pool.

## 8. Env file contents

These are the secret values, not files in git. Paste them into the Vault secrets from section 6.

Do not copy `server/.env.production.example` into Vault. That file is a short subset. It does not include `STORAGE_FORCE_PATH_STYLE`.

`rs0` must already be PRIMARY. API and Worker use the same `MONGODB_URI`, the same `REDIS_URL`, the same Object Storage block, the same `CLIENT_URL`, and the same `JWT_SECRET`.

`MONGODB_URI` must contain `authSource=admin`, `replicaSet=rs0`, and `retryWrites=true`:

```text
mongodb://arivu:<PASSWORD>@<PRIVATE_MONGO_IP>:27017/arivu_master?authSource=admin&replicaSet=rs0&retryWrites=true
```

Object Storage on **both** secrets. `STORAGE_FORCE_PATH_STYLE=true` is required:

```text
IMPORT_STORAGE_DRIVER=oci
STORAGE_ENDPOINT=https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
STORAGE_REGION=<region>
STORAGE_BUCKET=arivu-production
STORAGE_ACCESS_KEY=<secret>
STORAGE_SECRET_KEY=<secret>
STORAGE_FORCE_PATH_STYLE=true
```

`arivu-api-env` (API only adds the five lines marked below):

```bash
NODE_ENV=production
PORT=5000
CLIENT_URL=https://app.arivusystems.com
JWT_SECRET=<openssl rand -base64 48>
MONGODB_URI=mongodb://arivu:<PASSWORD>@<PRIVATE_MONGO_IP>:27017/arivu_master?authSource=admin&replicaSet=rs0&retryWrites=true
REDIS_URL=redis://:<password>@<PRIVATE_REDIS_IP>:6379
REDIS_HEALTH_BLOCKS_READY=true
ENABLE_BULL_IN_WEB=false
ENABLE_SCHEDULED_JOBS=false
GENERAL_RATE_LIMIT_REDIS_FAILURE_MODE=fail-closed
ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE=fail-closed
RATE_LIMIT_REDIS_REQUIRED=true
EXPRESS_TRUST_PROXY=1
IMPORT_STORAGE_DRIVER=oci
STORAGE_ENDPOINT=https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
STORAGE_REGION=<region>
STORAGE_BUCKET=arivu-production
STORAGE_ACCESS_KEY=<secret>
STORAGE_SECRET_KEY=<secret>
STORAGE_FORCE_PATH_STYLE=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
SENTRY_DSN=<dsn-or-omit>
AMDS_BASE_URL=<amds-origin>
AMDS_API_KEY=<amds-key>
AMDS_WEBHOOK_SECRET=<shared-secret>
```

API-only values:

- `PORT=5000`
- `ENABLE_BULL_IN_WEB=false`
- `ENABLE_SCHEDULED_JOBS=false`
- `EXPRESS_TRUST_PROXY=1`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable`

`ENABLE_BULL_IN_WEB=false` and `ENABLE_SCHEDULED_JOBS=false` keep queue consumers and cron off the API. The Worker runs them. The Worker ignores those two flags if they are present, so leave them off the Worker file. `EXPRESS_TRUST_PROXY=1` matches one OCI load balancer hop. `REDIS_HEALTH_BLOCKS_READY=true` makes `/health/ready` depend on Redis. Copy the rest of the integration secrets you already use (OCI Email Delivery SMTP, parser API key, Razorpay, Sentry) from the current production env. Do not set `DISABLE_SECURITY=true`.

Embeddings are not required to boot. If Arivu embeddings are intended to use this OCI MongoDB instead of MongoDB Atlas, set `AI_VECTOR_STORE=mongo` on both API and Worker. Leave it unset if you are still on Atlas. The process default is `atlas`, which only warns at startup.

`arivu-worker-env` uses the same shared production values. It does **not** include:

- `PORT`
- `ENABLE_BULL_IN_WEB`
- `ENABLE_SCHEDULED_JOBS`
- `PUPPETEER_EXECUTABLE_PATH`

```bash
NODE_ENV=production
CLIENT_URL=https://app.arivusystems.com
JWT_SECRET=<same value as the API>
MONGODB_URI=mongodb://arivu:<PASSWORD>@<PRIVATE_MONGO_IP>:27017/arivu_master?authSource=admin&replicaSet=rs0&retryWrites=true
REDIS_URL=redis://:<password>@<PRIVATE_REDIS_IP>:6379
REDIS_HEALTH_BLOCKS_READY=true
GENERAL_RATE_LIMIT_REDIS_FAILURE_MODE=fail-closed
ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE=fail-closed
RATE_LIMIT_REDIS_REQUIRED=true
EXPRESS_TRUST_PROXY=1
IMPORT_STORAGE_DRIVER=oci
STORAGE_ENDPOINT=https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
STORAGE_REGION=<region>
STORAGE_BUCKET=arivu-production
STORAGE_ACCESS_KEY=<secret>
STORAGE_SECRET_KEY=<secret>
STORAGE_FORCE_PATH_STYLE=true
SENTRY_DSN=<dsn-or-omit>
AMDS_BASE_URL=<amds-origin>
AMDS_API_KEY=<amds-key>
AMDS_WEBHOOK_SECRET=<shared-secret>
```

Generate `JWT_SECRET` on your laptop with `openssl rand -base64 48`. Use that one value in both secrets. Use the same `REDIS_URL` in both secrets.

## 9. API instance configuration and pool

The pool starts at **size 1**. This is API #1. Do not start it until MongoDB `rs0` is PRIMARY. Raise the size to 2 only in section 15, after the legacy quote/invoice migration in section 14.

### Instance configuration

1. Navigation menu → **Compute** → **Instance Configurations** → **Create instance configuration**.
2. Name: `arivu-api-<release-tag>`. Compartment: `arivu-production`.
3. Image: **Canonical Ubuntu 24.04**. Shape: AMD flexible, **2 OCPU**, **8 GB**.
4. Networking: VCN `arivu-vcn`, subnet the **private** subnet, **Do not assign a public IPv4 address**, NSG `nsg-api`.
5. SSH key: paste `~/.ssh/arivu_oci.pub`.
6. Show advanced options → **Management** → paste the API cloud-init script (the copy with `ROLE="api"`).
7. Show tagging options → tag namespace `arivu`, key `role`, value `api`.
8. Create.

### Instance pool

1. Navigation menu → **Compute** → **Instance Pools** → **Create instance pool**.
2. Name: `arivu-api`. Compartment: `arivu-production`.
3. Instance configuration: `arivu-api-<release-tag>`.
4. Number of instances: `1`.
5. Add a placement for every fault domain the console lists, each in the private subnet `10.0.1.0/24` and the availability domain you used for MongoDB. Two instances can then land in different fault domains.
6. Do not attach a load balancer yet. The load balancer does not exist.
7. Create.

Wait until the pool is **Running** and its one instance is **Running**. First boot installs Node.js 22.12.0 or newer, Chrome, and the app. That takes several minutes after the instance shows Running.

### Check from a bastion session

Username `ubuntu`. Then:

```bash
cloud-init status
sudo tail -n 80 /var/log/arivu-bootstrap.log
sudo test -f /var/lib/arivu-bootstrap-ok && echo bootstrap-ok
sudo systemctl status arivu-api --no-pager
curl -fsS http://127.0.0.1:5000/health/live
curl -fsS http://127.0.0.1:5000/health/ready
sudo journalctl -u arivu-api -n 100 --no-pager
node -p "process.versions.node"
google-chrome-stable --version
```

`/health/ready` must be HTTP 200 with Mongo connected and `redis.ok: true`. HTTP 503 means Mongo or Redis is unreachable, or `REDIS_URL` is missing.

Confirm the log line `Email queue consumer disabled in web` and `Scheduled jobs disabled`.

`node -p "process.versions.node"` must print `22.12.0` or a later Node 22 version. `22.0.0` through `22.11.x` means bootstrap should have failed. Chrome must print a version. The private IP of this instance is whatever the pool assigned. You do not put that IP in DNS.

### If bootstrap failed

Read `/var/log/arivu-bootstrap.log`. Typical causes: the dynamic group tag is missing, the policy is in the wrong compartment, the secret OCID is wrong, or the release tag does not exist. Fix the cause, then on the pool’s instance use **Detach instance** → permanently terminate it → **Replace the instance with a new instance**. The replacement boots the script again. Cloud-init does not re-run on a reboot of the same instance.

## 10. Worker instance configuration and pool

Repeat section 9 with these differences:

| | API | Worker |
|--|-----|--------|
| Configuration name | `arivu-api-<release-tag>` | `arivu-worker-<release-tag>` |
| Pool name | `arivu-api` | `arivu-worker` |
| Cloud-init | `ROLE="api"` | `ROLE="worker"` |
| Tag `arivu.role` | `api` | `worker` |
| NSG | `nsg-api` | `nsg-worker` |
| systemd unit | `arivu-api` | `arivu-worker` |
| Load balancer | Attached in section 11 | Never |

Pool size: `1`.

Chrome is not installed on the Worker.

### Check

```bash
sudo test -f /var/lib/arivu-bootstrap-ok && echo bootstrap-ok
sudo systemctl status arivu-worker --no-pager
sudo journalctl -u arivu-worker -n 80 --no-pager
node -p "process.versions.node"
```

Logs must include Mongo connected, scheduled jobs started, and the Bull consumers (email, inbound email, import, campaign, analytics). If Redis is down the process exits. `node -p "process.versions.node"` must be `22.12.0` or newer on the Node 22 line. The Worker uses the same `REDIS_URL` as the API.

There is no port to curl. The Worker does not listen for HTTP. Chrome is not installed here, and the Worker env has no `PUPPETEER_EXECUTABLE_PATH`.

## 11. Load balancer

1. Navigation menu → **Networking** → **Load Balancers** → **Create Load Balancer**.
2. Type: **Load Balancer**. Name: `arivu-api-lb`. Visibility: **Public**. Compartment: `arivu-production`.
3. VCN: `arivu-vcn`. Subnet: the **public** subnet. Shape: **Flexible**, a small minimum bandwidth you can raise later (10 Mbps is enough to start).
4. NSG: `nsg-lb`.
5. Listener: name `https-443`, protocol **HTTPS**, port **443**.
6. Certificate: add the certificate for `api.arivusystems.com`. Paste the certificate PEM, the private key PEM, and the CA chain if you have one. TLS ends here. Do not also run nginx or certbot on the API instances.
7. Backend set: name `arivu-api`.
   - Add no backends. The instance pool adds them. If the wizard will not continue without one, add the current API private IP, port `5000`, and delete that manual backend after the pool attachment shows the same IP.
   - Health check: protocol HTTP, port 5000, URL path `/health/ready`, status code 200. Interval 10000 ms, timeout 5000 ms.
   - Session persistence: none.
8. Create the load balancer. Wait until it is **Active**. Copy its **public IP**.
9. Open the load balancer → the backend set `arivu-api` → **Backend set configuration** or **Details** → set the **idle timeout** to **3600** seconds. The default 60 seconds kills inbox, notification, internal chat, and telephony SSE.
10. Leave HTTP/1.1 on the path to Node so `Upgrade` works for WebSocket `/api/astra/studio/ws`.

### Attach the API pool

1. Navigation menu → **Compute** → **Instance Pools** → `arivu-api`.
2. **Load balancers** (under Resources) → **Attach load balancer**.
3. Load balancer: `arivu-api-lb`. Backend set: `arivu-api`. Port: `5000`. VNIC: **Primary VNIC**.
4. Attach.

OCI adds the current API instance to the backend set and will add every later instance the same way. Wait until that backend’s health is **OK**.

Do not attach `arivu-worker`.

SSE routes that must stay open through the balancer:

- `/api/notifications/stream`
- `/api/communications/inbox/stream`
- `/api/data-changes/stream`
- `/api/internal-chat/stream`
- `/api/telephony/stream`
- `/api/live-chat/sessions/:sessionId/stream`

WebSocket:

- `/api/astra/studio/ws`

The older VM certbot runbook (`OCI_SSL_CERT_RENEWAL_RUNBOOK.md`) applies only if TLS is terminated on a VM. This design terminates TLS on the load balancer.

## 12. DNS

DNS is in Hostinger today.

| Name | Record | Target |
|------|--------|--------|
| `api.arivusystems.com` | A | Load balancer public IP |
| `app.arivusystems.com` | unchanged | Vercel |
| `arivusystems.com` / `www` | unchanged | Marketing site |

Do not point `app` at OCI.

After the A record propagates:

```bash
curl -fsS https://api.arivusystems.com/health/ready
```

Vercel already rewrites `/api` to `https://api.arivusystems.com` (`client/vercel.json`). `CLIENT_URL` on the API is `https://app.arivusystems.com`. Default CORS already allows `https://app.arivusystems.com`, `https://arivusystems.com`, and `https://www.arivusystems.com`.

## 13. Test production

Run these while both pools are still size 1. Fix the first failure before you continue. Do not raise either pool size yet. Do not start the legacy migration until Object Storage in this table has passed.

The load balancer probe is `GET /health/ready` (and liveness is `GET /health/live`). Two other routes are on the same public hostname and are not locked down by application code:

- `GET /health/status` has no authentication. The JSON includes the MongoDB host name and connection state. Do not publish it as a status page. Use `/health/ready` for the load balancer.
- `GET /health/mailroom-metrics` returns Prometheus text with no authentication unless `MAILROOM_METRICS_TOKEN` is set. Set that token on the API env if those metrics must not be readable on `api.arivusystems.com`. Requests then need `Authorization: Bearer <token>` or `X-Metrics-Token`.

`GET /internal/notifications/health` returns 403 in production unless `INTERNAL_HEALTH_TOKEN` matches. That token is optional.

| Check | Pass |
|-------|------|
| API liveness | `curl -fsS https://api.arivusystems.com/health/live` |
| API readiness | `GET /health/ready` is 200, Mongo connected, `redis.ok` true |
| Load balancer backend | The one API backend is **OK** |
| Redis from API | Readiness stays 200. Stop Redis briefly: readiness becomes 503 (`REDIS_HEALTH_BLOCKS_READY=true`). Start Redis again before continuing. |
| MongoDB | API log shows master DB connected. `rs.status()` still PRIMARY. A write from the app (sign-in or a settings read) succeeds. |
| Object Storage | Upload a file in the app (import CSV or a document). Object appears under the bucket. `IMPORT_STORAGE_DRIVER=oci` is set on both API and Worker. |
| Worker | `systemctl is-active arivu-worker`. Logs show email, inbound, and import consumers. |
| Queues | Trigger one outbound email. Worker log shows the email Bull job. API log does not say the web consumer is running. |
| WebSocket | Browser or `wscat` to `wss://api.arivusystems.com/api/astra/studio/ws`. The balancer must complete the upgrade. An application auth error after the upgrade still means the socket passed the balancer. |
| SSE | Open the app inbox or notifications while watching the connection. It must still be open after 60 seconds. |
| Email | System mail (OCI Email Delivery SMTP) and one AMDS send if `AMDS_BASE_URL` and `AMDS_API_KEY` are set. |
| Inbound parser | `GET https://api.arivusystems.com/api/webhooks/arivu/inbound-email/health` returns the health payload. Send one parser fixture to `POST /api/webhooks/arivu/inbound-email` and confirm the Worker inbound consumer logs the job. |
| AMDS | `GET https://api.arivusystems.com/api/internal/webhooks/amds/health`. A signed AMDS webhook to `POST /api/internal/webhooks/amds` is accepted (`AMDS_WEBHOOK_SECRET` matches AMDS). |

## 14. Legacy quote and invoice files

Required before the API pool goes from 1 to 2. Do this only after section 13 is green and an upload has landed in the `arivu-production` bucket.

Older quote and invoice PDFs were written under `server/public` on the machine that generated them (`/api/quote-documents/...` and `/api/invoice-documents/...`, `storageProvider` not `oci`). `express.static` serves those files from that disk. API #2 does not have them. New PDFs already go to Object Storage and do not need this step.

Run the script on a machine that still has those files under `server/public`, from `/opt/arivu/src/server`, with the API env loaded so `MONGODB_URI` and the `STORAGE_*` variables are set. A new API VM does not have PDFs that were written on an older host. Copy that `server/public` tree onto the machine first, or run the script on the old host with the production URI and Object Storage variables. Dry run first. It prints what it would copy and does not upload.

```bash
sudo -u arivu bash -lc 'set -a && . /etc/arivu/api.env && set +a && cd /opt/arivu/src/server && node scripts/migrateLegacyQuoteInvoiceDocuments.js'
```

Then apply. The script uploads to Object Storage and updates the rows. It does not delete the local files.

```bash
sudo -u arivu bash -lc 'set -a && . /etc/arivu/api.env && set +a && cd /opt/arivu/src/server && node scripts/migrateLegacyQuoteInvoiceDocuments.js --apply'
```

If the dry run lists no documents, there is nothing to upload. Continue to section 15. If it lists documents, confirm one of those PDFs still downloads through the app after `--apply`. Leave the API pool at size 1 until that download works. The local files under `server/public` stay on disk.

## 15. Increase the API pool to 2

Only after section 14.

1. Navigation menu → **Compute** → **Instance Pools** → `arivu-api` → **Edit**.
2. Number of instances: `2`. Save.
3. Wait until the new instance is **Running**, `/var/lib/arivu-bootstrap-ok` exists, `node -p "process.versions.node"` is `22.12.0` or newer, and the load balancer shows **two** backends in state **OK**.

The new instance uses the same instance configuration, the same Vault secret, and the same `JWT_SECRET`. The pool registers the new private IP on port 5000 by itself.

Drain one API backend in the load balancer console (backend menu → **Drain** or set it offline, whichever the console shows) and confirm the app still loads, including a quote or invoice PDF that section 14 moved, then bring it back.

Leave the Worker pool at size 1 until this check passes.

## 16. Increase the Worker pool to 2

Only after section 15.

1. Navigation menu → **Compute** → **Instance Pools** → `arivu-worker` → **Edit**.
2. Number of instances: `2`. Save.
3. Wait until the new Worker’s journal shows the Bull consumers running and `node -p "process.versions.node"` is `22.12.0` or newer.

Cron ticks take a Redis lock (`arivu:scheduler-lock:*`) so the second Worker does not double-run the same tick. Both Workers use the same `REDIS_URL`.

## 17. Metric autoscaling

Leave this off until sections 15 and 16 are healthy and you want OCI to add and remove instances from CPU load. A quiet pool scales back down to the minimum. During the first production week, staying at size 2 without this section is the stable choice.

When you turn it on:

1. Navigation menu → **Compute** → **Autoscaling Configurations** → **Create Autoscaling Configuration**.
2. Name: `arivu-api-cpu`. Compartment: `arivu-production`. Instance pool: `arivu-api`.
3. Cooldown: `300` seconds.
4. Policy type: **Metric-based**. Performance metric: **CPU utilization**.
5. Scale out: greater than `70` percent, change count by `+1`.
6. Scale in: less than `30` percent, change count by `-1`.
7. Minimum instances: `1`. Maximum instances: `2`. Initial: `2`.
8. Create.
9. Repeat for `arivu-worker` as `arivu-worker-cpu`, with the same thresholds. The Worker pool still has no load balancer.

While an autoscaling configuration is attached, it overwrites a size you set by hand. Delete the autoscaling configuration before a manual size change, or change the minimum and maximum in the policy instead.

Scale-in terminates an instance. Keep the cooldown at 300 seconds. For the API, the load balancer stops sending new requests after the health check fails; an SSE connection on that instance drops and the client reconnects through another instance.

## 18. Deploy a later release

You do not SSH in and `git pull`. A release is a new instance configuration whose cloud-init script has the new `RELEASE_TAG`. Existing VMs keep running until you replace them.

1. Tag the release in git.
2. Create instance configuration `arivu-api-<new-tag>` from section 9, with the new tag in the script. Same shape, subnet, NSG, SSH key, and `arivu.role=api`.
3. Create `arivu-worker-<new-tag>` the same way, with `ROLE="worker"`.
4. Open pool `arivu-api` → **Edit** → Instance configuration: the new API configuration → **Save**. Running instances stay on the old release. Only instances created after this edit use the new configuration.
5. On the pool’s instance list, for **one** API instance: **Actions** → **Detach instance**.
6. Select **Permanently terminate (delete) this instance and its attached boot volume**.
7. Select **Replace the instance with a new instance, using the pool's instance configuration**.
8. Detach. The pool starts a replacement. Wait until that backend is **OK** on `/health/ready` and the bootstrap marker file exists.
9. Detach and replace the other API instance the same way.
10. Point pool `arivu-worker` at the new Worker configuration, then detach and replace Worker instances **one at a time**. Wait until the new instance’s journal shows the Bull consumers before replacing the next one.

Replacing the only API instance causes downtime until cloud-init finishes. Stay at pool size 2 before you deploy this way.

## 19. What stays manual

| Resource | Why it is not a pool |
|----------|----------------------|
| MongoDB VM | One replica-set member, one data disk |
| Redis VM | One queue store |
| Load balancer | One public entry |
| Vercel app | `app.arivusystems.com` |
| Vault secrets | Edited when an env value changes, then instances are replaced so they read the new secret |

Changing an env value: create a new version of the Vault secret (secret details → **Create Secret Version**), then replace instances as in section 18. A reboot does not re-read Vault. Cloud-init runs on first boot only.
