import React, { useId } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Overlay } from '../../../components/overlay';
import { FULL_PAGE_PANEL_CLASS } from '../../../components/fullPagePanel';
import { Button, IconButton, cn } from '../../../components/ui';

interface OrgMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDirty: boolean;
  editName: string;
  setEditName: (val: string) => void;
  editSlug: string;
  setEditSlug: (val: string) => void;
  editDescription: string;
  setEditDescription: (val: string) => void;
  editWebsite: string;
  setEditWebsite: (val: string) => void;
  deleteError: string | null;
  onDeleteOrganization: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const OrgMetadataModal: React.FC<OrgMetadataModalProps> = ({
  isOpen,
  onClose,
  isDirty,
  editName,
  setEditName,
  editSlug,
  setEditSlug,
  editDescription,
  setEditDescription,
  editWebsite,
  setEditWebsite,
  deleteError,
  onDeleteOrganization,
  onSubmit,
}) => {
  const titleId = useId();

  if (!isOpen) return null;

  return (
    <Overlay
      open
      onClose={onClose}
      dirty={isDirty}
      aria-labelledby={titleId}
      mobile="center"
      panelClassName={cn(
        'max-h-[90vh] max-w-140 overflow-y-auto rounded-lg border border-line bg-elevated p-7 shadow-[0_20px_40px_rgba(0,0,0,0.6)] max-md:p-4 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]',
        FULL_PAGE_PANEL_CLASS
      )}
    >
      {({ requestClose }) => (
        <>
          <div className="mb-5 flex items-center justify-between">
            <h2 id={titleId} className="m-0 text-xl font-extrabold text-white">
              Edit Organization Details
            </h2>
            <IconButton aria-label="Close" onClick={requestClose}>
              <X size={18} />
            </IconButton>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-caption font-semibold text-fg-secondary">
                Organization Name *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full rounded-sm border border-line bg-canvas px-3.5 py-2.5 text-sm text-white max-md:text-base"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-caption font-semibold text-fg-secondary">
                URL Slug *
              </label>
              <input
                type="text"
                required
                value={editSlug}
                onChange={e => setEditSlug(e.target.value)}
                className="w-full rounded-sm border border-line bg-canvas px-3.5 py-2.5 font-mono text-sm text-white max-md:text-base"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-caption font-semibold text-fg-secondary">
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                rows={2}
                className="w-full rounded-sm border border-line bg-canvas px-3.5 py-2.5 text-sm text-white max-md:text-base"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-caption font-semibold text-fg-secondary">
                Website URL
              </label>
              <input
                type="url"
                inputMode="url"
                placeholder="https://..."
                value={editWebsite}
                onChange={e => setEditWebsite(e.target.value)}
                className="w-full rounded-sm border border-line bg-canvas px-3.5 py-2.5 text-sm text-white max-md:text-base"
              />
            </div>

            {deleteError && (
              <div className="rounded-sm bg-red/10 p-2 text-caption text-red-bright">
                {deleteError}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-7 max-md:flex-col max-md:items-stretch max-md:gap-3 max-md:border-t max-md:border-line max-md:bg-surface max-md:px-7 max-md:py-3">
              <Button
                type="button"
                variant="danger"
                onClick={onDeleteOrganization}
                className="px-3.5 py-2 text-caption max-md:w-full"
              >
                <Trash2 size={14} />
                <span>Delete Org</span>
              </Button>

              <div className="flex gap-3 max-md:flex-col">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={requestClose}
                  className="max-md:w-full"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="max-md:w-full">
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </>
      )}
    </Overlay>
  );
};
