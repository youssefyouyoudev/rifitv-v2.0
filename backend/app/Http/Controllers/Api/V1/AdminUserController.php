<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminUserRequest;
use App\Http\Resources\RoleResource;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminUserController extends Controller
{
    public function index()
    {
        return UserResource::collection(User::query()->with('roles')->orderBy('name')->paginate(50));
    }

    public function roles()
    {
        return RoleResource::collection(Role::query()->orderBy('name')->get());
    }

    public function store(AdminUserRequest $request, AuditService $audit)
    {
        $data = $request->validated();
        $roleIds = $data['role_ids'] ?? [];
        unset($data['role_ids']);
        $data['password'] = Hash::make($data['password']);
        $data['is_admin'] = true;
        $user = User::query()->create($data);
        $user->roles()->sync($roleIds);
        $audit->record($request->user(), 'user.created', $user);

        return new UserResource($user->load('roles'));
    }

    public function update(AdminUserRequest $request, User $user, AuditService $audit)
    {
        $data = $request->validated();
        $roleIds = $data['role_ids'] ?? null;
        unset($data['role_ids']);
        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }
        $user->update($data);
        if (is_array($roleIds)) {
            $user->roles()->sync($roleIds);
        }
        $audit->record($request->user(), 'user.updated', $user);

        return new UserResource($user->load('roles'));
    }

    public function revokeSessions(Request $request, User $user, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('users.manage'), 403);
        $user->tokens()->delete();
        $audit->record($request->user(), 'user.sessions_revoked', $user);

        return response()->json(['data' => ['message' => 'Sessions revoked']]);
    }
}
