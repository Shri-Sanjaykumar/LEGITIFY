import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshCookie = cookieStore.get('refresh_token');

    if (!refreshCookie || !refreshCookie.value) {
      return NextResponse.json(
        { success: false, message: 'No refresh token available', data: null, errors: ['Refresh token cookie missing'], request_id: '' },
        { status: 401 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

    const response = await fetch(`${backendUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `refresh_token=${refreshCookie.value}`,
      },
    });

    const json = await response.json();

    if (!response.ok || !json.success) {
      // Clear cookie since it is invalid/expired
      cookieStore.delete('refresh_token');
      return NextResponse.json(
        {
          success: false,
          message: json.message || 'Token refresh failed',
          data: null,
          errors: json.errors || [json.detail || 'Token refresh failed'],
          request_id: json.request_id || '',
        },
        { status: response.status }
      );
    }

    // Extract cookie from backend response
    const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
    const refreshTokenCookie = setCookies.find(c => c.trim().startsWith('refresh_token='));
    let refreshTokenValue = '';
    if (refreshTokenCookie) {
      refreshTokenValue = refreshTokenCookie.split(';')[0].split('=')[1];
    } else if (json.data && json.data.refresh_token) {
      refreshTokenValue = json.data.refresh_token;
    }

    const access_token = json.data?.access_token;

    // Set rotated refresh token in cookie
    if (refreshTokenValue) {
      cookieStore.set('refresh_token', refreshTokenValue, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: access_token,
      },
      errors: [],
      request_id: json.request_id || '',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error in auth refresh proxy',
        data: null,
        errors: [(error as Error).message],
        request_id: '',
      },
      { status: 500 }
    );
  }
}
