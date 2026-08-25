<?php

namespace App\Services;

use App\Enums\MatchStatus;
use App\Models\GameMatch;
use Illuminate\Support\Carbon;

class MatchStateService
{
    /**
     * @param GameMatch $match
     * @param Carbon|null $now
     * @return array{
     *     isLive:bool,
     *     isFinished:bool,
     *     isPostponed:bool,
     *     isCancelled:bool,
     *     playbackStatus:string,
     *     isWatchable:bool,
     *     displayStatus:string,
     *     title:string,
     *     subtitle:string,
     *     eventStatus:string,
     *     countdownSeconds:?int,
     *     countdownLabel:string
     * }
     */
    public function stateFor(GameMatch $match, ?Carbon $now = null): array
    {
        $now ??= now();

        // Basic status flags from the match itself
        $isLive = in_array($match->status, [MatchStatus::Live, MatchStatus::Halftime], true);
        $isFinished = $match->status === MatchStatus::Finished;
        $isPostponed = $match->status === MatchStatus::Postponed;
        $isCancelled = $match->status === MatchStatus::Cancelled;

        // Get playback window state
        $playbackWindow = app(PlaybackWindowService::class)->stateFor($match, $now);
        $playbackStatus = $playbackWindow['status'];

        // Determine if watchable (open playback window and at least one channel)
        $isWatchable = $playbackStatus === 'open' && $match->channels->count() > 0;

        // Compute countdown seconds and label
        $countdownSeconds = null;
        $countdownLabel = '';
        if ($playbackStatus === 'locked' || $playbackStatus === 'opening_soon') {
            $countdownSeconds = $playbackWindow['seconds_until_open'];
            $countdownLabel = 'Stream opens in';
        } else {
            $countdownSeconds = $playbackWindow['seconds_until_kickoff'];
            $countdownLabel = 'Starts in';
        }

        // Compute display status for the match card (what to show in the status area)
        if ($isLive) {
            $displayStatus = 'Live now';
        } elseif ($isFinished) {
            $displayStatus = 'Final';
        } elseif ($isPostponed) {
            $displayStatus = 'Postponed';
        } elseif ($isCancelled) {
            $displayStatus = 'Cancelled';
        } elseif ($playbackStatus === 'tbc') {
            $displayStatus = 'Kickoff time will be announced';
        } elseif ($playbackStatus === 'ended') {
            $displayStatus = 'Broadcast ended';
        } elseif ($countdownSeconds !== null) {
            $displayStatus = $countdownLabel; // We'll show the countdown instead of a text status
        } else {
            $displayStatus = date('D, j M', strtotime($match->scheduled_date)); // Fallback to date
        }

        // Compute title for the prematch panel
        if ($isFinished || $playbackStatus === 'ended') {
            $title = 'Broadcast ended';
        } elseif ($isPostponed) {
            $title = 'Postponed';
        } elseif ($isCancelled) {
            $title = 'Cancelled';
        } elseif ($playbackStatus === 'tbc') {
            $title = 'Kickoff time will be announced';
        } elseif ($playbackWindow['status'] === 'unavailable') {
            $title = 'Broadcast unavailable';
        } else {
            $title = 'Stream available soon';
        }

        // Compute subtitle for the prematch panel
        if ($playbackStatus === 'tbc') {
            $subtitle = 'Broadcast access will become available when the kickoff time is confirmed.';
        } elseif ($playbackWindow['status'] === 'unavailable') {
            $subtitle = 'No authorized broadcast sources are currently available for this match. Please check back closer to kickoff time.';
        } elseif ($playbackStatus === 'ended') {
            $subtitle = 'This broadcast window has closed.';
        } elseif ($isPostponed) {
            $subtitle = 'The match has been postponed. Please check back for the new schedule.';
        } elseif ($isCancelled) {
            $subtitle = 'The match has been cancelled.';
        } else {
            $subtitle = 'Kickoff - ' . date('g:i A', strtotime($match->kickoff_at));
        }

        // Compute event status for JSON-LD
        if ($isFinished) {
            $eventStatus = 'https://schema.org/EventCompleted';
        } elseif ($isPostponed) {
            $eventStatus = 'https://schema.org/EventPostponed';
        } elseif ($isCancelled) {
            $eventStatus = 'https://schema.org/EventCancelled';
        } elseif ($isLive) {
            $eventStatus = 'https://schema.org/EventInProgress';
        } else {
            $eventStatus = 'https://schema.org/EventScheduled';
        }

        return [
            'isLive' => $isLive,
            'isFinished' => $isFinished,
            'isPostponed' => $isPostponed,
            'isCancelled' => $isCancelled,
            'playbackStatus' => $playbackStatus,
            'isWatchable' => $isWatchable,
            'displayStatus' => $displayStatus,
            'title' => $title,
            'subtitle' => $subtitle,
            'eventStatus' => $eventStatus,
            'countdownSeconds' => $countdownSeconds,
            'countdownLabel' => $countdownLabel,
        ];
    }
}
