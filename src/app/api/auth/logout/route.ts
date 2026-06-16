import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const cookieStore = await cookies();
    const refreshCookie = cookieStore.get('refresh_token');
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

    if (authHeader) {
      // Forward logout call to backend to invalidate DB session
      try {
        const headers: Record<string, string> = {
          'Authorization': authHeader,
        };
        if (refreshCookie && refreshCookie.value) {
          headers['Cookie'] = `refresh_token=${refreshCookie.value}`;
        }
        await fetch(`${backendUrl}/auth/logout`, {
          method: 'POST',
          headers: headers,
        });
      } catch (e) {
        console.error('Failed to contact backend for logout:', e);
      }
    }

    // Clear the cookie
    cookieStore.delete('refresh_token');

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
      data: null,
      errors: [],
      request_id: '',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error in logout proxy',
        data: null,
        errors: [(error as Error).message],
        request_id: '',
      },
      { status: 500 }
    );
  }
}
