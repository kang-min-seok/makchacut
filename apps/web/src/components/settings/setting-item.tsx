import type { ReactNode } from 'react';

type SettingItemProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function SettingItem({ title, description, children }: SettingItemProps) {
  return (
    <div className="flex flex-col gap-2.5 px-5 pt-2.5 pb-4">
      <div>
        <h3 className="text-[15px] font-bold">{title}</h3>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingGroupTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-5 pt-6 pb-2 text-[13px] font-bold text-subtle-foreground">{children}</h2>
  );
}
