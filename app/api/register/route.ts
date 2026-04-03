import { NextResponse } from 'next/server';
import { registerUser } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, contraseña y nombre son requeridos' },
        { status: 400 }
      );
    }

    const user = await registerUser(email, password, name);
    
    return NextResponse.json(
      { message: 'Usuario registrado exitosamente', user },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error en registro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al registrar usuario' },
      { status: 400 }
    );
  }
}

