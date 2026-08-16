<?php

namespace App\Http\Requests;

use App\Enums\StreamProtocol;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdminStreamSourceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('streams.manage') ?? false;
    }

    public function rules(): array
    {
        return [
            'channel_id' => ['required', 'integer', 'exists:channels,id'],
            'name' => ['required', 'string', 'max:160'],
            'protocol' => ['required', Rule::in(StreamProtocol::values())],
            'url' => ['required', 'url', 'max:2000'],
            'priority' => ['sometimes', 'integer', 'min:0'],
            'enabled' => ['sometimes', 'boolean'],
            'is_backup' => ['sometimes', 'boolean'],
        ];
    }
}
