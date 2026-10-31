import React, { useState, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournament } from '../store';
import { useOrganization } from '../../organizations/store';
import { QualFormat, QualMode, Tournament, DEFAULT_POINTS_THRESHOLDS } from '../types';
import { createEmptyTournament } from '../defaults';
import { ClearableNumberInput } from '../../../components/ClearableNumberInput';
import { X, Building2 } from 'lucide-react';
import { Overlay } from '../../../components/overlay';
import { Button, IconButton, cn } from '../../../components/ui';

const modalLabelClass = 'mb-1.5 block text-caption font-semibold text-fg-secondary';
const modalInputClass = 'w-full rounded-sm border border-line bg-canvas py-2.5 px-3 text-sm text-fg outline-none';

interface CreateTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultOrgId?: string;
  fixedOrgId?: string;
  onCreated?: (tournament: Tournament) => void;
}

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  isOpen,
  onClose,
  defaultOrgId,
  fixedOrgId,
  onCreated,
}) => {
  const { createTournament } = useTournament();
  const { organizations, getOrganizationById } = useOrganization();
  const navigate = useNavigate();

  const initialOrgId = fixedOrgId || defaultOrgId || organizations[0]?.id || '';
  const [newTourneyOrgId, setNewTourneyOrgId] = useState<string>(initialOrgId);
  const [newTourneyName, setNewTourneyName] = useState('');
  const [newTourneySlug, setNewTourneySlug] = useState('');
  const [newTourneyDate, setNewTourneyDate] = useState('');
  const [newTourneyLocation, setNewTourneyLocation] = useState('');
  const [newTourneyMode, setNewTourneyMode] = useState<QualMode>('HYBRID');
  const [newTourneyWindowMinutes, setNewTourneyWindowMinutes] = useState<number>(90);
  const [newTourneyFormat, setNewTourneyFormat] = useState<QualFormat>('AVERAGE_OF_X');
  const [newTourneyAvgCount, setNewTourneyAvgCount] = useState<number | undefined>(2);
  const [avgCountError, setAvgCountError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const titleId = useId();

  // Sync with fixedOrgId or organizations loading
  useEffect(() => {
    const targetId = fixedOrgId || defaultOrgId || organizations[0]?.id || '';
    setNewTourneyOrgId(targetId);

    const org = getOrganizationById(targetId);
    if (org?.defaultRules) {
      if (org.defaultRules.qualFormat) setNewTourneyFormat(org.defaultRules.qualFormat);
      if (org.defaultRules.qualAverageCount) setNewTourneyAvgCount(org.defaultRules.qualAverageCount);
    }
  }, [fixedOrgId, defaultOrgId, organizations, getOrganizationById]);

  // When selected org changes (in non-fixed mode), inherit default rules
  const handleOrgChange = (orgId: string) => {
    setNewTourneyOrgId(orgId);
    const org = getOrganizationById(orgId);
    if (org?.defaultRules) {
      if (org.defaultRules.qualFormat) setNewTourneyFormat(org.defaultRules.qualFormat);
      if (org.defaultRules.qualAverageCount) setNewTourneyAvgCount(org.defaultRules.qualAverageCount);
    }
  };

  const handleNameChange = (name: string) => {
    setNewTourneyName(name);
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    setNewTourneySlug(slug);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTourneyName.trim() || !newTourneySlug.trim() || isCreating) return;

    let parsedAvgCount = 2;
    if (newTourneyFormat === 'AVERAGE_OF_X') {
      if (newTourneyAvgCount === undefined || isNaN(newTourneyAvgCount) || newTourneyAvgCount < 1) {
        setAvgCountError('Please enter a valid attempt count (minimum 1)');
        return;
      }
      parsedAvgCount = newTourneyAvgCount;
    }

    const org = getOrganizationById(newTourneyOrgId);

    setIsCreating(true);
    try {
      const created = await createTournament(
        createEmptyTournament({
          name: newTourneyName.trim(),
          slug: newTourneySlug.trim(),
          organizationId: newTourneyOrgId,
          date: newTourneyDate.trim() || 'Upcoming',
          location: newTourneyLocation.trim() || 'TBD',
          qualFormat: newTourneyFormat,
          qualAverageCount: parsedAvgCount,
          qualMode: newTourneyMode,
          qualWindowMinutes: newTourneyWindowMinutes,
          pointsConfig: newTourneyFormat === 'POINTS'
            ? (org?.defaultRules?.pointsConfig || DEFAULT_POINTS_THRESHOLDS)
            : undefined,
        })
      );

      onClose();
      if (onCreated) {
        onCreated(created);
      } else {
        navigate(`/${created.slug}/manage/settings`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const currentOrg = getOrganizationById(newTourneyOrgId);
  const isDirty =
    newTourneyName !== '' ||
    newTourneySlug !== '' ||
    newTourneyDate !== '' ||
    newTourneyLocation !== '' ||
    newTourneyMode !== 'HYBRID' ||
    newTourneyWindowMinutes !== 90 ||
    newTourneyFormat !== 'AVERAGE_OF_X' ||
    newTourneyAvgCount !== 2 ||
    newTourneyOrgId !== initialOrgId;

  return (
    <Overlay
      open
      onClose={onClose}
      dirty={isDirty}
      busy={isCreating}
      aria-labelledby={titleId}
      panelClassName="max-w-125 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
    >
      {({ requestClose }) => (
        <>
          <div className="flex items-center justify-between border-b border-line bg-elevated py-5 px-6">
            <h3 id={titleId} className="m-0 text-lg font-bold text-white">
              Create New Tournament
            </h3>
            <IconButton aria-label="Close" onClick={requestClose}>
              <X size={18} />
            </IconButton>
          </div>

          <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4 p-6">
            {/* Host Organization Selector */}
            <div>
              <label className={modalLabelClass}>Host Organization</label>
              {fixedOrgId ? (
                <div className={cn(modalInputClass, 'flex items-center gap-2 bg-white/4 font-semibold text-fg')}>
                  <Building2 size={16} color="var(--color-gold-bright, #ffc905)" />
                  <span>{currentOrg?.name || 'Current Organization'} ({currentOrg?.shortName || currentOrg?.slug})</span>
                </div>
              ) : (
                <select
                  value={newTourneyOrgId}
                  onChange={e => handleOrgChange(e.target.value)}
                  className={modalInputClass}
                >
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.shortName || org.slug})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className={modalLabelClass}>Tournament Name</label>
              <input
                type="text"
                value={newTourneyName}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g. St. Louis Open 2026"
                required
                className={modalInputClass}
              />
            </div>

            <div>
              <label className={modalLabelClass}>URL Slug</label>
              <input
                type="text"
                value={newTourneySlug}
                onChange={e => setNewTourneySlug(e.target.value)}
                required
                className={modalInputClass}
              />
            </div>

            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <div>
                <label className={modalLabelClass}>Event Date</label>
                <input
                  type="text"
                  value={newTourneyDate}
                  onChange={e => setNewTourneyDate(e.target.value)}
                  placeholder="e.g. April 12, 2026"
                  className={modalInputClass}
                />
              </div>
              <div>
                <label className={modalLabelClass}>Location</label>
                <input
                  type="text"
                  value={newTourneyLocation}
                  onChange={e => setNewTourneyLocation(e.target.value)}
                  placeholder="e.g. St. Louis, MO"
                  className={modalInputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <div>
                <label className={modalLabelClass}>Qualifying Mode</label>
                <select
                  value={newTourneyMode}
                  onChange={e => setNewTourneyMode(e.target.value as QualMode)}
                  className={modalInputClass}
                >
                  <option value="HYBRID">Hybrid (In-Person &amp; Online)</option>
                  <option value="IN_PERSON">In-Person Live Event</option>
                  <option value="ONLINE">100% Online Tournament</option>
                </select>
              </div>
              <div>
                <label className={modalLabelClass}>Qual Duration (Minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={newTourneyWindowMinutes}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    setNewTourneyWindowMinutes(isNaN(val) || val < 1 ? 1 : val);
                  }}
                  className={modalInputClass}
                />
              </div>
            </div>

            <div>
              <label className={modalLabelClass}>Qualifying Format</label>
              <select
                value={newTourneyFormat}
                onChange={e => setNewTourneyFormat(e.target.value as QualFormat)}
                className={modalInputClass}
              >
                <option value="AVERAGE_OF_X">Average of X Attempts</option>
                <option value="HIGH_SCORE"># of Maxes</option>
                <option value="POINTS">Points Threshold System</option>
              </select>
            </div>

            {newTourneyFormat === 'AVERAGE_OF_X' && (
              <div>
                <label className={modalLabelClass}>Target Attempt Count (X)</label>
                <ClearableNumberInput
                  min={1}
                  max={10}
                  value={newTourneyAvgCount}
                  onChange={val => {
                    setNewTourneyAvgCount(val);
                    if (avgCountError) setAvgCountError(null);
                  }}
                  error={avgCountError}
                  onErrorChange={setAvgCountError}
                  className={modalInputClass}
                />
              </div>
            )}

            <div className="mt-2 flex justify-end gap-3">
              <Button onClick={requestClose} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isCreating} className="gap-2">
                {isCreating && (
                  <div className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                <span>{isCreating ? 'Creating...' : 'Create & Configure'}</span>
              </Button>
            </div>
          </form>
        </>
      )}
    </Overlay>
  );
};

