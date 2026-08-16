<?php

namespace App\Http\Requests;

use App\Enums\CompetitionSelectionMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminCompetitionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('competitions.manage') ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('competition')?->id ?? $this->route('competition');

        return [
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180', 'unique:competitions,slug,'.$id],
            'short_name' => ['nullable', 'string', 'max:24'],
            'logo_path' => ['nullable', 'string', 'max:255'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'active' => ['sometimes', 'boolean'],
            'featured' => ['sometimes', 'boolean'],
            'selection_mode' => ['sometimes', Rule::in(CompetitionSelectionMode::values())],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'featured_team_ids' => ['sometimes', 'array'],
            'featured_team_ids.*' => ['integer', 'exists:teams,id'],
        ];
    }
}
