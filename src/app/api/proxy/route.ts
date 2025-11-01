import { NextRequest, NextResponse } from 'next/server';

// ✅ Production backend URL configured
// Backend is deployed at: https://demo-invoice-backend.onrender.com
const BACKEND_URL = process.env.BACKEND_URL || 'https://demo-invoice-backend.onrender.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || 'invoices';
    
    const backendUrl = `${BACKEND_URL}/api/${path}`;
    
    console.log('Proxy GET request to:', backendUrl);
    
    // Add timeout and retry logic for network issues
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    // Retry logic for network issues
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Attempt ${attempt}/3 to connect to backend...`);
        
        const response = await fetch(backendUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`Backend responded with status: ${response.status}`);
          throw new Error(`Backend responded with status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Successfully connected to backend on attempt ${attempt}`);
        
        return NextResponse.json(data, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      } catch (fetchError: any) {
        lastError = fetchError;
        console.error(`Attempt ${attempt}/3 failed:`, fetchError.message);
        
        if (fetchError.name === 'AbortError') {
          console.error('Request timeout - Backend may be slow or unresponsive');
          throw new Error('Request timeout - Backend may be slow or unresponsive');
        }
        
        // Check if it's a connection error (local development)
        if (fetchError.message && (fetchError.message.includes('ECONNREFUSED') || fetchError.message.includes('fetch failed'))) {
          console.error('Connection failed - Make sure backend is running on', BACKEND_URL);
          throw new Error(`Connection failed - Make sure backend is running on ${BACKEND_URL}`);
        }
        
        // If this is not the last attempt, wait before retrying
        if (attempt < 3) {
          console.log(`Waiting 2 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // If all attempts failed, throw the last error
        throw lastError;
      }
    }
  } catch (error: any) {
    console.error('Proxy error details:', {
      message: error.message || 'Unknown error',
      name: error.name || 'Unknown',
      stack: error.stack || 'No stack trace'
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch from backend',
        details: error.message,
        backendUrl: `${BACKEND_URL}/api/${request.nextUrl.searchParams.get('path') || 'invoices'}`
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || 'invoices';
    const backendUrl = `${BACKEND_URL}/api/${path}`;
    
    console.log('Proxy PUT request to:', backendUrl);
    
    const body = await request.json();
    
    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    console.error('Proxy PUT error details:', {
      message: error.message || 'Unknown error',
      name: error.name || 'Unknown',
      stack: error.stack || 'No stack trace'
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to update on backend',
        details: error.message || 'Unknown error',
        backendUrl: `${BACKEND_URL}/api/${request.nextUrl.searchParams.get('path') || 'invoices'}`
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || 'invoices';
    const backendUrl = `${BACKEND_URL}/api/${path}`;
    
    console.log('Proxy DELETE request to:', backendUrl);
    
    const response = await fetch(backendUrl, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error: any) {
    console.error('Proxy DELETE error details:', {
      message: error.message || 'Unknown error',
      name: error.name || 'Unknown',
      stack: error.stack || 'No stack trace'
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to delete on backend',
        details: error.message || 'Unknown error',
        backendUrl: `${BACKEND_URL}/api/${request.nextUrl.searchParams.get('path') || 'invoices'}`
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || 'invoice-upload';
    const backendUrl = `${BACKEND_URL}/api/${path}`;
    
    console.log('Proxy POST request to:', backendUrl);
    
    // Handle FormData uploads
    const formData = await request.formData();
    
    console.log('FormData received:', formData ? 'Yes' : 'No');
    
    // Log what we received
    const formDataEntries = Array.from(formData.entries());
    console.log('FormData entries:', formDataEntries.map(([key, value]) => [key, typeof value]));
    
    // Add timeout and retry logic for uploads
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for uploads
    
    // Retry logic for network issues
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Upload attempt ${attempt}/3 to backend...`);
        
        const response = await fetch(backendUrl, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Backend responded with status: ${response.status}`);
          console.error('Backend error response:', errorText);
          throw new Error(`Backend responded with status: ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log(`✅ Upload successful on attempt ${attempt}, response:`, data);
        
        return NextResponse.json(data, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      } catch (fetchError: any) {
        lastError = fetchError;
        console.error(`Upload attempt ${attempt}/3 failed:`, fetchError.message);
        
        if (fetchError.name === 'AbortError') {
          console.error('Upload request timeout - Backend may be slow');
          throw new Error('Upload request timeout - Backend may be slow');
        }
        
        // If this is not the last attempt, wait before retrying
        if (attempt < 3) {
          console.log(`Waiting 2 seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // If all attempts failed, throw the last error
        throw lastError;
      }
    }
  } catch (error: any) {
    console.error('Proxy POST error details:', {
      message: error.message || 'Unknown error',
      name: error.name || 'Unknown',
      stack: error.stack || 'No stack trace'
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to upload to backend',
        details: error.message || 'Unknown error',
        backendUrl: `${BACKEND_URL}/api/${request.nextUrl.searchParams.get('path') || 'invoice-upload'}`
      },
      { status: 500 }
    );
  }
}

// Add OPTIONS method for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 