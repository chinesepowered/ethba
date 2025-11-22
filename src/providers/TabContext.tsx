'use client';

import React, { createContext, useState, useContext, ReactNode, Dispatch, SetStateAction, useCallback } from 'react';

export type Tab = 'ads' | 'claim' | 'advertise';

interface TabContextType {
  activeTab: Tab;
  setActiveTab: Dispatch<SetStateAction<Tab>>;
  dataVersion: number;
  refreshData: () => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export const TabProvider = ({ children }: { children: ReactNode }) => {
  const [activeTab, setActiveTab] = useState<Tab>('ads');
  const [dataVersion, setDataVersion] = useState(0);

  const refreshData = useCallback(() => {
    setDataVersion(prevVersion => {
      if (process.env.NODE_ENV === 'development') {
        console.log('TabContext: refreshData called, new version:', prevVersion + 1);
      }
      return prevVersion + 1;
    });
  }, []);

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab, dataVersion, refreshData }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTabs = () => {
  const context = useContext(TabContext);
  if (context === undefined) {
    throw new Error('useTabs must be used within a TabProvider');
  }
  return context;
};
