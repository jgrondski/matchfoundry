import React, { useId } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Overlay } from '../../../components/overlay';

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
  editLogoUrl: string;
  setEditLogoUrl: (val: string) => void;
  editBannerUrl: string;
  setEditBannerUrl: (val: string) => void;
  deleteError: string | null;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => void;
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
  editLogoUrl,
  setEditLogoUrl,
  editBannerUrl,
  setEditBannerUrl,
  deleteError,
  handleFileUpload,
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
      panelClassName="max-h-[90vh] max-w-140 overflow-y-auto rounded-lg border border-line bg-elevated p-7 shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
    >
      {({ requestClose }) => (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 id={titleId} style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Edit Organization Details
            </h2>
            <button
              type="button"
              onClick={requestClose}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Organization Name *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={e => setEditName(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', fontSize: '0.9rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                URL Slug *
              </label>
              <input
                type="text"
                required
                value={editSlug}
                onChange={e => setEditSlug(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Website URL
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={editWebsite}
                onChange={e => setEditWebsite(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', fontSize: '0.85rem' }}
              />
            </div>

            {/* Logo with Local Browse Button */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Logo URL or Local File
              </label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="https://... or /assets/..."
                  value={editLogoUrl}
                  onChange={e => setEditLogoUrl(e.target.value)}
                  style={{ flex: 1, padding: '0.65rem 0.85rem', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', fontSize: '0.85rem' }}
                />
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                  title="Upload local image file"
                >
                  Browse
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleFileUpload(e, setEditLogoUrl)}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* Banner with Local Browse Button */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.35rem' }}>
                Banner URL or Local File
              </label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="https://... or /assets/..."
                  value={editBannerUrl}
                  onChange={e => setEditBannerUrl(e.target.value)}
                  style={{ flex: 1, padding: '0.65rem 0.85rem', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', fontSize: '0.85rem' }}
                />
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                  title="Upload local image file"
                >
                  Browse
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleFileUpload(e, setEditBannerUrl)}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {deleteError && (
              <div style={{ fontSize: '0.8rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={onDeleteOrganization}
                className="btn btn-danger"
                style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem' }}
              >
                <Trash2 size={14} />
                <span>Delete Org</span>
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={requestClose}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </div>
          </form>
        </>
      )}
    </Overlay>
  );
};
