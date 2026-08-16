<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $roles = collect([
            ['Owner', 'owner', ['*']],
            ['Editor', 'editor', ['admin.search', 'matches.manage', 'scores.manage', 'teams.manage', 'competitions.manage']],
            ['Stream Manager', 'stream-manager', ['admin.search', 'streams.manage']],
            ['Content Manager', 'content-manager', ['admin.search', 'content.manage', 'settings.manage']],
            ['Operations Manager', 'operations-manager', ['admin.search', 'automation.manage', 'alerts.view', 'audit.view', 'health.view', 'sync.view', 'streams.manage']],
        ])->mapWithKeys(fn (array $row): array => [
            $row[1] => Role::query()->updateOrCreate(['slug' => $row[1]], [
                'name' => $row[0],
                'permissions' => $row[2],
            ]),
        ]);

        $name = env('RIFITV_ADMIN_NAME', 'Youssef');
        $email = env('RIFITV_ADMIN_EMAIL', 'contact@youssefyouyou.com');
        $password = env('RIFITV_ADMIN_PASSWORD');
        $user = User::query()->where('email', $email)->first();

        if (! $user && blank($password)) {
            throw new \RuntimeException('RIFITV_ADMIN_PASSWORD must be set when creating the production admin for the first time.');
        }

        $attributes = [
            'name' => $name,
            'active' => true,
            'is_admin' => true,
        ];

        if (filled($password)) {
            $attributes['password'] = Hash::make((string) $password);
        }

        $admin = User::query()->updateOrCreate(['email' => $email], $attributes);
        $admin->roles()->syncWithoutDetaching([$roles['owner']->id]);
    }
}
