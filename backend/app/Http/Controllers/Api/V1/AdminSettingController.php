<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use App\Services\AuditService;
use Illuminate\Http\Request;

class AdminSettingController extends Controller
{
    private array $allowed = [
        'site_name',
        'tagline',
        'display_timezone',
        'default_locale',
        'maintenance_mode',
        'seo_defaults',
        'social_links',
        'default_player_behavior',
    ];

    public function index(Request $request)
    {
        abort_unless($request->user()?->hasPermission('settings.manage'), 403);

        return response()->json(['data' => SiteSetting::query()->whereIn('key', $this->allowed)->orderBy('key')->get()]);
    }

    public function update(Request $request, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('settings.manage'), 403);
        $validated = $request->validate([
            'settings' => ['required', 'array'],
            'settings.*.key' => ['required', 'string', 'in:'.implode(',', $this->allowed)],
            'settings.*.value' => ['nullable'],
        ]);

        foreach ($validated['settings'] as $setting) {
            SiteSetting::query()->updateOrCreate(['key' => $setting['key']], ['value' => $setting['value']]);
        }
        $audit->record($request->user(), 'settings.updated', null, ['count' => count($validated['settings'])]);

        return $this->index($request);
    }
}
