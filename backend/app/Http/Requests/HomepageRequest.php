<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class HomepageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('content.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'sections' => ['required', 'array'],
            'sections.*.key' => ['required', 'string', 'max:80'],
            'sections.*.title' => ['required', 'string', 'max:160'],
            'sections.*.type' => ['required', 'string', 'max:32'],
            'sections.*.enabled' => ['sometimes', 'boolean'],
            'sections.*.sort_order' => ['sometimes', 'integer', 'min:0'],
            'sections.*.limit' => ['sometimes', 'integer', 'min:1', 'max:24'],
            'sections.*.competition_id' => ['nullable', 'integer', 'exists:competitions,id'],
            'sections.*.hero_match_id' => ['nullable', 'integer', 'exists:matches,id'],
            'sections.*.configuration' => ['nullable', 'array'],
        ];
    }
}
