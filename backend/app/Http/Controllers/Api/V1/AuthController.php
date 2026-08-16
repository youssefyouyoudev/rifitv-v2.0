<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminLoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(AdminLoginRequest $request, AuditService $audit)
    {
        $key = Str::lower((string) $request->input('email')).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw ValidationException::withMessages(['email' => ['Too many login attempts. Please wait before trying again.']]);
        }

        $user = User::query()->where('email', $request->input('email'))->first();

        if (! $user || ! $user->active || ! Hash::check((string) $request->input('password'), $user->password) || ! $user->is_admin) {
            RateLimiter::hit($key, 60);
            $audit->record(null, 'auth.login_failed', null, ['email_hash' => hash('sha256', Str::lower((string) $request->input('email')))]);

            throw ValidationException::withMessages([
                'email' => ['The provided credentials could not be verified.'],
            ]);
        }

        RateLimiter::clear($key);
        $user->load('roles');
        $token = null;

        if ($request->hasSession()) {
            Auth::guard('web')->login($user);
            $request->session()->regenerate();
        } else {
            $token = $user->createToken('admin-dashboard')->plainTextToken;
        }

        $audit->record($user, 'auth.login_success');

        return response()->json([
            'data' => [
                'user' => new UserResource($user),
                'token' => $token,
            ],
        ]);
    }

    public function me(Request $request)
    {
        return response()->json(['data' => new UserResource($request->user()->loadMissing('roles'))]);
    }

    public function logout(Request $request)
    {
        $accessToken = $request->user()?->currentAccessToken();
        if ($accessToken && method_exists($accessToken, 'delete')) {
            $accessToken->delete();
        }

        if ($request->hasSession()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            Auth::forgetGuards();
        }

        return response()
            ->json(['data' => ['message' => 'Logged out']])
            ->withoutCookie((string) config('session.cookie'));
    }
}
