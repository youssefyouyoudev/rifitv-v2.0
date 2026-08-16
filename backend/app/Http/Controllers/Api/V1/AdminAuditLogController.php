<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AdminAuditLogController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()?->hasPermission('audit.view'), 403);

        return AuditLogResource::collection(AuditLog::query()
            ->with('actor')
            ->when($request->filled('action'), fn ($query) => $query->where('action', $request->string('action')))
            ->latest()
            ->paginate((int) min($request->integer('per_page', 50), 100)));
    }
}
