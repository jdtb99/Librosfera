import axios from 'axios';

// Helper function to get cookies
export const getCookie = (name) => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

// Helper function to set cookies
export const setCookie = (name, value, days = 1) => {
  let expires = '';
  
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = `; expires=${date.toUTCString()}`;
  }
  
  document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/`;
};

// Function to verify token
export const verifyToken = async (token) => {
  try {
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/v1/auth/verify-token`, {
      headers: {
        'Authorization': `Bearer ${String(token)}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
    });
    
    console.log('verifyToken response:', response);
    return { success: true, response: response };
  } catch (err) {
    console.error('Error verifying token:', err);
    return { success: false, error: err };
  }
};

// Function to refresh user data and update cookie
export const refreshUserData = async () => {
  try {
    // Get data from cookies
    const dataCookie = getCookie("data");
    if (!dataCookie) {
      console.log('No cookie found');
      return { success: false, error: 'No cookie found' };
    }
    
    console.log('Cookie found:', dataCookie);
    
    // Parse cookie data
    const userData = JSON.parse(dataCookie);
    console.log('Parsed user data:', userData);
    
    // Extract token based on the structure
    let token;
    if (userData.Data && userData.Data.token) {
      token = userData.Data.token;
    } else if (userData.token) {
      token = userData.token;
    } else {
      console.log('No token found in cookie');
      return { success: false, error: 'No token found in cookie' };
    }
    
    console.log('Using token:', token);
    
    // Verify token and get updated user data
    const result = await verifyToken(token);
    console.log('verifyToken result:', result);
    
    if (!result.success) {
      console.log('Token verification failed');
      return { success: false, error: 'Token verification failed' };
    }
    
    const response = result.response;
    
    // Check if response and response.data exist
    if (!response || !response.data) {
      console.log('Invalid response from verify token');
      return { success: false, error: 'Invalid response from verify token' };
    }
    
    console.log('Response structure:', {
      status: response.status,
      data: response.data
    });
    
    // Get user data based on the structure returned by the API
    let updatedUserData = null;
    
    // Check possible response structures
    if (response.data.status === 'success' && response.data.data) {
      // Standard structure with data inside data.data
      updatedUserData = response.data.data;
    } else if (response.data.user) {
      // Alternative structure with user data directly in data.user
      updatedUserData = response.data.user;
    } else if (response.data.status === 'success' && response.data.user) {
      // Alternative structure with user in data.user
      updatedUserData = response.data.user;
    } else {
      // If no recognized structure, use the whole data as fallback
      updatedUserData = response.data;
    }
    
    console.log('Updated user data:', updatedUserData);
    
    if (updatedUserData) {
      // Create updated cookie object maintaining the same structure
      let updatedCookieData;
      
      if (userData.Data) {
        // If the cookie has Data structure, maintain it
        updatedCookieData = {
          ...userData,
          Data: {
            ...userData.Data, // Keep existing fields
            ...updatedUserData, // Update with new data
            token: token, // Keep the original token
            isAdmin: updatedUserData.tipo_usuario === 'administrador' || 
                    updatedUserData.tipo_usuario === 'root'
          }
        };
      } else {
        // Otherwise update the root level
        updatedCookieData = {
          ...userData, // Keep existing fields
          ...updatedUserData, // Update with new data
          token: token // Keep the original token
        };
      }
      
      console.log('Updated cookie data:', updatedCookieData);
      
      // Save to cookie
      setCookie("data", JSON.stringify(updatedCookieData));
      
      return { 
        success: true, 
        data: userData.Data ? updatedCookieData.Data : updatedCookieData 
      };
    } else {
      console.log('No user data found in response');
      return { success: false, error: 'No user data found in response' };
    }
  } catch (err) {
    console.error('Error refreshing user data:', err);
    return { success: false, error: err.message || 'Error refreshing user data' };
  }
};

// Function to fetch user data from cookies
export const fetchUserData = async () => {
  try {
    // Get data from cookies
    const token = getCookie("data");
    if (!token) {
      return { success: false, error: 'No se encontró información de usuario' };
    }

    const userDataFromCookie = JSON.parse(token);
    console.log("Raw cookie data:", userDataFromCookie); // Debug cookie data
    
    // Verify token validity
    try {
      const result = await verifyToken(userDataFromCookie.Data.token);
      if (!result.success) {
        return { success: false, error: 'Su sesión ha expirado' };
      }
    } catch (verifyError) {
      return { success: false, error: 'Su sesión ha expirado' };
    }

    // Debug the user data
    console.log("User data structure:", userDataFromCookie.Data);
    
    // Add a property to help with admin check (for compatibility with your AdminProfile component)
    // This is used by the AdminProfile component to check if the user is an admin
    if (userDataFromCookie.Data.tipo_usuario === 'administrador' || 
        userDataFromCookie.Data.tipo_usuario === 'root') {
      userDataFromCookie.Data.isAdmin = true;
    } else {
      userDataFromCookie.Data.isAdmin = false;
    }

    // Return user data from cookie
    return { success: true, data: userDataFromCookie.Data };
  } catch (err) {
    console.error('Error fetching user data:', err);
    return { success: false, error: 'Error al cargar datos de usuario' };
  }
};

// Helper function to get user data directly from cookie without verification
export const getUserDataFromCookie = () => {
  try {
    const dataCookie = getCookie("data");
    if (!dataCookie) return null;
    
    const userData = JSON.parse(dataCookie);
    return userData.Data || userData;
  } catch (err) {
    console.error('Error parsing user data from cookie:', err);
    return null;
  }
};

// Function to logout user
export const logoutUser = () => {
  // Clear the auth cookie
  document.cookie = "data=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  
  // Redirect to login page
  window.location.href = '/Login';
};

// Format date for display
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  return new Date(dateString).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};