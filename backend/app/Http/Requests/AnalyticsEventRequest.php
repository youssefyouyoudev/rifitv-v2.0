<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AnalyticsEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'event' => ['required', 'string', 'max:64', 'in:page_view,match_opened,watch_clicked,playback_started,playback_failed,channel_switched,search_submitted,competition_viewed,match_shared,cta_clicked,returning_visitor,favorite_toggled,reminder_toggled'],
            'visitor_id' => ['nullable', 'string', 'max:128'],
            'path' => ['nullable', 'string', 'max:512'],
            'payload' => ['nullable', 'array', 'max:20'],
        ];
    }
}
