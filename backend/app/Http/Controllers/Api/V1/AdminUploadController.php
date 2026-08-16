<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AdminUploadController extends Controller
{
    public function logo(Request $request, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('content.manage') || $request->user()?->hasPermission('teams.manage') || $request->user()?->hasPermission('streams.manage'), 403);

        $validated = $request->validate([
            'logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
            'folder' => ['nullable', 'in:teams,competitions,channels'],
        ]);

        $file = $validated['logo'];
        $folder = $validated['folder'] ?? 'uploads';
        $name = Str::uuid().'.'.$file->getClientOriginalExtension();
        $path = $file->storeAs("public/{$folder}", $name);
        $publicPath = Storage::url($path);
        $audit->record($request->user(), 'upload.logo', null, ['folder' => $folder]);

        return response()->json(['data' => ['path' => $publicPath]]);
    }
}
