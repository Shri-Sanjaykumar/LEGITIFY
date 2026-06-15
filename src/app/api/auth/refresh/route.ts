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
      },
      body: JSON.stringify({ refresh_token: refreshCookie.value }),
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

    const { access_token, refresh_token } = json.data;

    // Set rotated refresh token in cookie
    cookieStore.set('refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

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
