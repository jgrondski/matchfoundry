import React from 'react';
import { Send } from 'lucide-react';
import { Button, cn } from '../../../components/ui';
import { QualFormat, PointsThreshold } from '../../tournament/types';
import { QualFormatEditor } from '../../tournament/components/QualFormatEditor';

interface OrgSettingsTabProps {
  orgName: string;
  qualFormat: QualFormat;
  qualAverageCount?: number;
  pointsConfig: PointsThreshold[];
  bestOf: number;
  discordWebhookUrl: string;
  webhookTestStatus: string | null;
  onQualFormatChange: (format: QualFormat) => void;
  onAverageCountChange: (count: number | undefined) => void;
  onPointsConfigChange: (config: PointsThreshold[]) => void;
  onBestOfChange: (bestOf: number) => void;
  onDiscordWebhookUrlChange: (url: string) => void;
  onTestWebhook: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const OrgSettingsTab: React.FC<OrgSettingsTabProps> = ({
  orgName,
  qualFormat,
  qualAverageCount,
  pointsConfig,
  bestOf,
  discordWebhookUrl,
  webhookTestStatus,
  onQualFormatChange,
  onAverageCountChange,
  onPointsConfigChange,
  onBestOfChange,
  onDiscordWebhookUrlChange,
  onTestWebhook,
  onSubmit,
}) => {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-7">
      <div className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6">
        <div>
          <h3 className="m-0 mb-1 text-lg font-extrabold text-white">
            Default Tournament Rules
          </h3>
          <p className="m-0 text-caption text-fg-muted">
            New tournaments hosted under {orgName} will automatically inherit these qualifying and match play rules.
          </p>
        </div>

        <QualFormatEditor
          qualFormat={qualFormat}
          qualAverageCount={qualAverageCount}
          pointsConfig={pointsConfig}
          onFormatChange={onQualFormatChange}
          onAverageCountChange={onAverageCountChange}
          onPointsConfigChange={onPointsConfigChange}
        />

        <div className="max-w-75">
          <label className="mb-1.5 block text-caption font-semibold text-fg-secondary">
            Default Bracket Best-of Match
          </label>
          <select
            value={bestOf}
            onChange={e => onBestOfChange(parseInt(e.target.value, 10) || 5)}
            className="w-full rounded-sm border border-line bg-canvas px-3.5 py-2.5 text-sm text-white"
          >
            <option value={3}>Best of 3</option>
            <option value={5}>Best of 5</option>
            <option value={7}>Best of 7</option>
          </select>
        </div>
      </div>

      {/* Discord Webhook Groundwork */}
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="m-0 mb-1 flex items-center gap-2 text-lg font-extrabold text-white">
              <span>Circuit Discord Webhook</span>
              <span className="rounded-xs bg-blue-500/20 px-2 py-0.5 text-3xs font-semibold text-blue-400">
                Groundwork
              </span>
            </h3>
            <p className="m-0 text-caption text-fg-muted">
              Announcements, tournament registrations, and championship alerts can dispatch to your organization's Discord channel.
            </p>
          </div>
        </div>

        <div className="flex gap-2.5">
          <input
            type="text"
            placeholder="https://discord.com/api/webhooks/..."
            value={discordWebhookUrl}
            onChange={e => onDiscordWebhookUrlChange(e.target.value)}
            className="flex-1 rounded-sm border border-line bg-canvas px-3.5 py-2.5 text-sm text-white"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={onTestWebhook}
            className="gap-1.5 px-4 py-2.5"
          >
            <Send size={14} />
            <span>Test Ping</span>
          </Button>
        </div>

        {webhookTestStatus && (
          <div className={cn('text-caption font-semibold', webhookTestStatus.startsWith('✅') ? 'text-green-bright' : 'text-red-bright')}>
            {webhookTestStatus}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          className="px-7 py-2.5 text-base"
        >
          Save Default Rules &amp; Webhook
        </Button>
      </div>
    </form>
  );
};
