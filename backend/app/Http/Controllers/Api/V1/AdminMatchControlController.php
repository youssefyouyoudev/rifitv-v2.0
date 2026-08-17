<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\MatchStatus;
use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\GameMatch;
use App\Services\AuditService;
use App\Services\LiveMatchService;
use App\Services\MatchControlService;
use App\Services\MatchService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminMatchControlController extends Controller
{
    public function show(GameMatch $match, MatchControlService $service)
    {
        return response()->json(['data' => $service->payload($match)]);
    }

    public function assignChannels(Request $request, GameMatch $match, MatchControlService $service)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);
        $validated = $request->validate([
            'channel_id' => ['sometimes', 'integer', 'exists:channels,id'],
            'channel_ids' => ['sometimes', 'array'],
            'channel_ids.*' => ['integer', 'exists:channels,id'],
        ]);

        $channelIds = $validated['channel_ids'] ?? [$validated['channel_id'] ?? null];
        $channelIds = array_values(array_filter($channelIds));

        return response()->json(['data' => $service->payload($service->assignChannels($match, $channelIds, $request->user()))]);
    }

    public function removeChannel(Request $request, GameMatch $match, Channel $channel, MatchControlService $service)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);

        return response()->json(['data' => $service->payload($service->removeChannel($match, $channel, $request->user()))]);
    }

    public function promoteChannel(Request $request, GameMatch $match, Channel $channel, MatchControlService $service)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);

        return response()->json(['data' => $service->payload($service->promoteChannel($match, $channel, $request->user()))]);
    }

    public function playback(Request $request, GameMatch $match, MatchControlService $service)
    {
        abort_unless($request->user()?->hasPermission('streams.manage'), 403);
        $validated = $request->validate(['action' => ['required', Rule::in(['open_now', 'close_now', 'extend_15', 'extend_30', 'reopen_30'])]]);

        return response()->json(['data' => $service->payload($service->playbackAction($match, $validated['action'], $request->user()))]);
    }

    public function score(Request $request, GameMatch $match, MatchControlService $service)
    {
        abort_unless($request->user()?->hasPermission('scores.manage'), 403);
        $validated = $request->validate([
            'home_score' => ['required', 'integer', 'min:0', 'max:99'],
            'away_score' => ['required', 'integer', 'min:0', 'max:99'],
            'minute' => ['nullable', 'integer', 'min:0', 'max:130'],
        ]);

        return response()->json(['data' => $service->payload($service->updateScore($match, $validated, $request->user()))]);
    }

    public function status(Request $request, GameMatch $match, LiveMatchService $live, MatchControlService $service)
    {
        abort_unless($request->user()?->hasPermission('scores.manage'), 403);
        $validated = $request->validate([
            'status' => ['required', Rule::in(array_column(MatchStatus::cases(), 'value'))],
            'override_transition' => ['sometimes', 'boolean'],
        ]);

        $updated = $live->update($match, [
            'home_score' => $match->home_score ?? 0,
            'away_score' => $match->away_score ?? 0,
            'minute' => $match->minute,
            'status' => $validated['status'],
            'featured' => $match->featured,
            'override_transition' => $validated['override_transition'] ?? true,
        ], $request->user());

        return response()->json(['data' => $service->payload($updated)]);
    }

    public function feature(Request $request, GameMatch $match, MatchControlService $service, MatchService $matches, AuditService $audit)
    {
        abort_unless($request->user()?->hasPermission('matches.manage'), 403);
        $validated = $request->validate(['featured' => ['required', 'boolean']]);
        $before = $match->featured;
        $matches->setFeatured($match, $validated['featured']);
        $audit->record($request->user(), $validated['featured'] ? 'match.featured' : 'match.unfeatured', $match, ['before' => $before]);

        return response()->json(['data' => $service->payload($match->fresh())]);
    }
}
