// Test script to verify AI service connectivity
// Run this in your browser console or as a Node.js script

const testAIConnection = async () => {
  console.log('🧪 Testing AI Service Connection...');
  
  const testMessage = "There's a fire emergency at the station!";
  const aiServiceUrl = 'https://chatanalysisapi-production.up.railway.app/analyze-message';
  
  try {
    console.log('📡 Sending test request to:', aiServiceUrl);
    console.log('📝 Test message:', testMessage);
    
    const response = await fetch(aiServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: testMessage })
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ AI Service Response:', data);
      return data;
    } else {
      const errorText = await response.text();
      console.error('❌ AI Service Error:', response.status, errorText);
      return null;
    }
  } catch (error) {
    console.error('❌ Connection Error:', error);
    return null;
  }
};

// Test the connection
testAIConnection().then(result => {
  if (result) {
    console.log('🎉 AI Service is working!');
  } else {
    console.log('💥 AI Service is not responding');
  }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testAIConnection };
}

