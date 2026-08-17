<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\GameMatch;
use App\Services\PlaybackSourceSelector;

class PlaybackController extends Controller
{
    public function __invoke(string $slug, PlaybackSourceSelector $selector)
    {
        $match = GameMatch::query()
            ->with(['channels.streamSources'])
            ->published()
            ->slugOrLegacy($slug)
            ->firstOrFail();

        return response()->json(['data' => $selector->responseFor($match)]);
    }
}
