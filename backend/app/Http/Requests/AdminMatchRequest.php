<?php

namespace App\Http\Requests;

use App\Enums\MatchStatus;
use App\Enums\MatchVisibility;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminMatchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('matches.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'competition_id' => ['required', 'integer', 'exists:competitions,id'],
            'home_team_id' => ['required', 'integer', 'exists:teams,id', 'different:away_team_id'],
            'away_team_id' => ['required', 'integer', 'exists:teams,id'],
            'kickoff_at' => ['required', 'date'],
            'status' => ['sometimes', Rule::in(array_column(MatchStatus::cases(), 'value'))],
            'home_score' => ['nullable', 'integer', 'min:0', 'max:99'],
            'away_score' => ['nullable', 'integer', 'min:0', 'max:99'],
            'minute' => ['nullable', 'integer', 'min:0', 'max:130'],
            'featured' => ['sometimes', 'boolean'],
            'published' => ['sometimes', 'boolean'],
            'visibility' => ['sometimes', Rule::in(MatchVisibility::values())],
            'slug' => ['nullable', 'string', 'max:160'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'channel_ids' => ['sometimes', 'array'],
            'channel_ids.*' => ['integer', 'exists:channels,id'],
        ];
    }
}
