import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, password, full_name, role } = await request.json();

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { success: false, message: 'All fields are required', data: null, errors: [], request_id: '' },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

    // Register call to FastAPI
    const registerResponse = await fetch(`${backendUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, full_name, role: role || 'student' }),
    });

    const registerJson = await registerResponse.json();

    if (!registerResponse.ok || !registerJson.success) {
      return NextResponse.json(
        {
          success: false,
          message: registerJson.message || 'Registration failed',
          data: null,
          errors: registerJson.errors || [registerJson.detail || 'Registration failed'],
          request_id: registerJson.request_id || '',
        },
        { status: registerResponse.status }
      );
    }

    // Auto-login on success
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const loginResponse = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const loginJson = await loginResponse.json();

    if (!loginResponse.ok || !loginJson.success) {
      // Return success but indicate login failed
      return NextResponse.json({
        success: true,
        message: 'Registered successfully. Please log in manually.',
        data: { user: registerJson.data, accessToken: null },
        errors: [],
        request_id: registerJson.request_id || '',
      });
    }

    // Extract cookie from login response
    const setCookies = loginResponse.headers.getSetCookie ? loginResponse.headers.getSetCookie() : [];
    const refreshTokenCookie = setCookies.find(c => c.trim().startsWith('refresh_token='));
    let refreshTokenValue = '';
    if (refreshTokenCookie) {
      refreshTokenValue = refreshTokenCookie.split(';')[0].split('=')[1];
    } else if (loginJson.data && loginJson.data.refresh_token) {
      refreshTokenValue = loginJson.data.refresh_token;
    }

    const access_token = loginJson.data?.access_token;

    // Set refresh token cookie
    const cookieStore = await cookies();
    cookieStore.set('refresh_token', refreshTokenValue, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return NextResponse.json({
      success: true,
      message: 'Registered and logged in successfully',
      data: {
        accessToken: access_token,
      },
      errors: [],
      request_id: loginJson.request_id || '',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error in registration proxy',
        data: null,
        errors: [(error as Error).message],
        request_id: '',
      },
      { status: 500 }
    );
  }
}
