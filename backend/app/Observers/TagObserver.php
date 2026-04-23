<?php
namespace App\Observers;

use App\Models\Tag;
use App\Models\AuditLog;

class TagObserver
{
    public function created(Tag $tag): void
    {
        AuditLog::registrar('created', 'Tag', $tag->id, null, $tag->toArray());
    }

    public function updated(Tag $tag): void
    {
        AuditLog::registrar('updated', 'Tag', $tag->id, $tag->getOriginal(), $tag->getChanges());
    }

    public function deleted(Tag $tag): void
    {
        AuditLog::registrar('deleted', 'Tag', $tag->id, $tag->toArray(), null);
    }
}