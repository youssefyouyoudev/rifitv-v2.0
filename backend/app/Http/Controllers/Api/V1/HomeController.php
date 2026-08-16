<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AnnouncementResource;
use App\Http\Resources\CompetitionResource;
use App\Http\Resources\MatchResource;
use App\Services\PublicContentService;

class HomeController extends Controller
{
    public function __invoke(PublicContentService $content)
    {
        $payload = $content->homePayload();

        return response()->json([
            'data' => [
                'server_time' => $payload['server_time'],
                'date' => $payload['date'],
                'date_label' => $payload['date_label'],
                'timezone' => $payload['timezone'],
                'live_count' => $payload['live_count'],
                'today_count' => $payload['today_count'],
                'matches' => MatchResource::collection($payload['matches']),
                'next_match' => $payload['next_match'] ? new MatchResource($payload['next_match']) : null,
                'announcements' => AnnouncementResource::collection($payload['announcements']),
                'competitions' => CompetitionResource::collection($payload['competitions']),
            ],
        ]);
    }
}
