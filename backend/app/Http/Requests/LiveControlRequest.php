<?php

namespace App\Http\Requests;

use App\Enums\MatchStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LiveControlRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('scores.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'home_score' => ['required', 'integer', 'min:0', 'max:99'],
            'away_score' => ['required', 'integer', 'min:0', 'max:99'],
            'minute' => ['nullable', 'integer', 'min:0', 'max:130'],
            'status' => ['required', Rule::in(array_column(MatchStatus::cases(), 'value'))],
            'featured' => ['sometimes', 'boolean'],
            'override_transition' => ['sometimes', 'boolean'],
            'playback_action' => ['sometimes', 'in:open_now,close_now,extend_15,extend_30,reopen_30'],
        ];
    }
}
