<?php

namespace App\Enums;

enum StreamHealth: string
{
    case Healthy = 'healthy';
    case Degraded = 'degraded';
    case Offline = 'offline';
    case Unknown = 'unknown';
    case Checking = 'checking';
    case BrowserIncompatible = 'browser_incompatible';
    case Disabled = 'disabled';
}
