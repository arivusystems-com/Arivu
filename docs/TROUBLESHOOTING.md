# 🔧 Troubleshooting Demo Request Submission

## ✅ Backend Test - SUCCESSFUL!

Tested with curl - the backend API works perfectly:

```bash
curl -X POST http://localhost:3000/api/demo/request \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Corp",
    "industry": "Technology", 
    "companySize": "11-50",
    "contactName": "Test User",
    "email": "test@example.com"
  }'

# Response:
{
  "success": true,
  "message": "Thank you for your interest! Our team will contact you within 24 hours.",
  "requestId": "68f8d66fff6f6bd3222899da",
  "organizationId": "68f8d66fff6f6bd3222899d6", 
  "contactId": "68f8d66fff6f6bd3222899d8"
}
```

## 🔍 If Frontend Still Shows Error:

### **Step 1: Hard Refresh Browser**
- **Mac:** `Cmd + Shift + R`
- **Windows/Linux:** `Ctrl + Shift + F5`

This clears cached JavaScript/CSS

### **Step 2: Check Browser Console**
1. Open DevTools (F12)
2. Go to Console tab
3. Look for red error messages
4. Check Network tab for the actual request/response

### **Step 3: Verify Form Data**
Make sure all required fields are filled:
- ✅ Company Name
- ✅ Industry
- ✅ Company Size
- ✅ Contact Name
- ✅ Email

### **Step 4: Check Network Tab**
1. Open DevTools → Network tab
2. Submit form
3. Find the `demo/request` call
4. Click on it
5. Check:
   - **Request URL:** Should be `http://localhost:5173/api/demo/request`
   - **Status:** Should be 200 (not 500)
   - **Response:** Check the JSON response

### **Step 5: Clear All Cache**
If hard refresh doesn't work:

1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

OR

1. DevTools → Application tab
2. Clear Storage → Clear Site Data

### **Step 6: Restart Frontend**
```bash
# Stop frontend (Ctrl+C in the terminal running it)
# Or kill it:
lsof -ti:5173 | xargs kill -9

# Start fresh:
cd /Users/Prabhu/Documents/GitHub/Arivu/client
npm run dev
```

## 🐛 Common Issues & Solutions

### **Error: "Not authorized, no token"**
- ✅ This is NORMAL for `/api/demo/request` - it's a public endpoint
- The error should NOT appear for demo requests
- If it does, the route configuration is wrong

### **Error: "Validation failed"**
- Check backend logs for specific validation errors
- Most common: missing required fields

### **Error: "Email already exists"**
- The demo request with that email was already submitted
- Use a different email for testing

### **Error: CORS**
- Check that backend is running on port 3000
- Check vite.config.ts proxy is configured

## 📝 Current Status

✅ **Backend:** Running on http://localhost:3000  
✅ **Frontend:** Running on http://localhost:5173  
✅ **Database:** Connected  
✅ **API Endpoint:** Working (tested with curl)  
✅ **Organization Creation:** Working  
✅ **Contact Creation:** Working  

## 🎯 Next Steps

1. **Hard refresh browser**
2. **Open Console (F12)**
3. **Submit demo request**
4. **Copy/paste ANY error messages you see**

Then we can debug the specific issue!

