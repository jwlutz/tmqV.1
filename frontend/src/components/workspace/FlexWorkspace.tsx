import { useRef, useCallback, useEffect, useState } from 'react'
import { Layout, Model, TabNode, IJsonModel, Actions, DockLocation } from 'flexlayout-react'
import 'flexlayout-react/style/dark.css'
import { ChartTabContent } from './ChartTabContent'
import { ChatSidebarContent } from './ChatPaneContent'
import { CodeTabContent } from './CodeTabContent'
import { BacktestResults } from '../backtest/BacktestResults'
import { RotContent } from '../rot/RotContent'
import { SECPaneContent } from './SECPaneContent'
import { useBacktest } from '../../context'
import { LAYOUT_PRESETS, type LayoutPreset } from '../../widgets/presets'
import type { WidgetType } from '../../widgets/types'

type ComponentType = 'chart' | 'chat' | 'code' | 'backtest' | 'rot' | 'sec'

// Generate a FlexLayout model for a preset layout
function buildPresetModel(preset: LayoutPreset): IJsonModel {
  const global = {
    tabEnableClose: true,
    tabEnableDrag: true,
    tabEnableRename: false,
    tabSetEnableMaximize: true,
    tabSetEnableDrop: true,
    tabSetEnableDrag: true,
    tabSetEnableDivide: true,
    splitterSize: 6,
    splitterExtra: 4,
  }

  // Create chart tabs based on preset
  const chartTabs = preset.panes.map((_pane, i) => ({
    type: 'tab' as const,
    name: `Chart ${i + 1}`,
    component: 'chart' as const,
    id: `preset-chart-${i + 1}`,
  }))

  // Build layout based on preset.layout (1x1, 1x2, 2x2)
  let chartLayout: any
  if (preset.layout === '1x1') {
    chartLayout = {
      type: 'tabset',
      weight: 66,
      id: 'chart-tabset',
      children: [chartTabs[0]],
    }
  } else if (preset.layout === '1x2') {
    chartLayout = {
      type: 'row',
      weight: 66,
      children: [
        { type: 'tabset', weight: 50, id: 'chart-tabset-1', children: [chartTabs[0]] },
        { type: 'tabset', weight: 50, id: 'chart-tabset-2', children: [chartTabs[1]] },
      ],
    }
  } else {
    // 2x2 layout
    chartLayout = {
      type: 'row',
      weight: 66,
      children: [
        {
          type: 'row',
          weight: 50,
          children: [
            { type: 'tabset', weight: 50, id: 'chart-tabset-1', children: [chartTabs[0]] },
            { type: 'tabset', weight: 50, id: 'chart-tabset-2', children: [chartTabs[1]] },
          ],
        },
        {
          type: 'row',
          weight: 50,
          children: [
            { type: 'tabset', weight: 50, id: 'chart-tabset-3', children: [chartTabs[2]] },
            { type: 'tabset', weight: 50, id: 'chart-tabset-4', children: [chartTabs[3]] },
          ],
        },
      ],
    }
  }

  return {
    global,
    borders: [],
    layout: {
      type: 'row',
      weight: 100,
      children: [
        chartLayout,
        // Chat column
        {
          type: 'tabset',
          weight: 34,
          id: 'chat-tabset',
          children: [{ type: 'tab', name: 'Chat', component: 'chat', id: 'tab-chat' }],
        },
      ],
    },
  }
}

// Default model: Chart+Code on left (2/3), Chat on right (1/3)
const DEFAULT_MODEL: IJsonModel = {
  global: {
    tabEnableClose: true,
    tabEnableDrag: true,
    tabEnableRename: false,
    tabSetEnableMaximize: true,
    tabSetEnableDrop: true,
    tabSetEnableDrag: true,
    tabSetEnableDivide: true,
    splitterSize: 6,
    splitterExtra: 4,
  },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      // Left column (2/3 width): Chart on top, Code below
      {
        type: 'row',
        weight: 66,
        children: [
          {
            type: 'tabset',
            weight: 66,
            id: 'chart-tabset',
            children: [
              {
                type: 'tab',
                name: 'Chart',
                component: 'chart',
                id: 'tab-chart',
              },
            ],
          },
          {
            type: 'tabset',
            weight: 34,
            id: 'code-tabset',
            children: [
              {
                type: 'tab',
                name: 'Code',
                component: 'code',
                id: 'tab-code',
              },
            ],
          },
        ],
      },
      // Right column (1/3 width): Chat
      {
        type: 'tabset',
        weight: 34,
        id: 'chat-tabset',
        children: [
          {
            type: 'tab',
            name: 'Chat',
            component: 'chat',
            id: 'tab-chat',
          },
        ],
      },
    ],
  },
}

const STORAGE_KEY = 'flexlayout-model'

function loadModel(): Model {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const json = JSON.parse(saved) as IJsonModel
      return Model.fromJson(json)
    }
  } catch (e) {
    console.warn('Failed to load layout from localStorage:', e)
  }
  return Model.fromJson(DEFAULT_MODEL)
}

function saveModel(model: Model) {
  try {
    const json = model.toJson()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(json))
  } catch (e) {
    console.warn('Failed to save layout to localStorage:', e)
  }
}

// Factory function maps component string to React component
// Each tab gets its own instance with its ID for independent state
function factory(node: TabNode): React.ReactNode {
  const component = node.getComponent() as ComponentType
  const tabId = node.getId()

  switch (component) {
    case 'chart':
      return <ChartTabContent tabId={tabId} />
    case 'chat':
      // Chat tabs share the same conversation (by design)
      return <ChatSidebarContent />
    case 'code':
      return <CodeTabContent tabId={tabId} />
    case 'backtest':
      return <BacktestResults />
    case 'rot':
      return <RotContent />
    case 'sec':
      return <SECPaneContent />
    default:
      return (
        <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">
          Unknown component: {component}
        </div>
      )
  }
}

export function FlexWorkspace() {
  const [modelKey, setModelKey] = useState(0) // Force re-render on model change
  const modelRef = useRef<Model>(loadModel())
  const { backtestResult } = useBacktest()
  const prevResultRef = useRef<typeof backtestResult>(null)
  const pendingPresetRef = useRef<LayoutPreset | null>(null)

  const handleModelChange = useCallback((model: Model) => {
    saveModel(model)
  }, [])

  // Auto-open backtest tab when new results arrive
  useEffect(() => {
    if (backtestResult && backtestResult !== prevResultRef.current) {
      prevResultRef.current = backtestResult
      const model = modelRef.current

      // Check if backtest tab already exists
      let hasBacktestTab = false
      model.visitNodes(node => {
        if (node.getType() === 'tab' && (node as TabNode).getComponent() === 'backtest') {
          hasBacktestTab = true
        }
      })

      if (!hasBacktestTab) {
        // Add new backtest tab
        const tabset = model.getActiveTabset() || model.getFirstTabSet()
        if (tabset) {
          model.doAction(
            Actions.addNode(
              { type: 'tab', name: 'Backtest', component: 'backtest', id: 'tab-backtest' },
              tabset.getId(),
              DockLocation.CENTER,
              -1,
              true
            )
          )
        }
      } else {
        // Select existing backtest tab
        model.visitNodes(node => {
          if (node.getType() === 'tab' && (node as TabNode).getComponent() === 'backtest') {
            model.doAction(Actions.selectTab(node.getId()))
          }
        })
      }
    }
  }, [backtestResult])

  // Expose addTab for TopBar via window (simple approach for demo)
  useEffect(() => {
    (window as any).__flexLayoutAddTab = (type: ComponentType) => {
      const model = modelRef.current
      const tabset = model.getActiveTabset() || model.getFirstTabSet()
      if (!tabset) return

      model.doAction(
        Actions.addNode(
          { type: 'tab', name: type.charAt(0).toUpperCase() + type.slice(1), component: type },
          tabset.getId(),
          DockLocation.CENTER,
          -1,
          true
        )
      )
    }

    // Expose selectTab for AI control - select by ID or by type
    (window as any).__flexLayoutSelectTab = (tabId?: string, tabType?: string) => {
      const model = modelRef.current

      // If tabId is provided, select it directly
      if (tabId) {
        try {
          model.doAction(Actions.selectTab(tabId))
          return
        } catch {
          // Tab ID not found, fall through to type search
        }
      }

      // If tabType is provided (or tabId failed), find first tab of that type
      if (tabType) {
        model.visitNodes(node => {
          if (node.getType() === 'tab' && (node as TabNode).getComponent() === tabType) {
            model.doAction(Actions.selectTab(node.getId()))
          }
        })
      }
    }

    // Expose applyPreset for AI control - apply a dashboard preset
    (window as any).__flexLayoutApplyPreset = (presetId: string) => {
      const preset = LAYOUT_PRESETS[presetId]
      if (!preset) {
        console.warn(`Unknown preset: ${presetId}`)
        return false
      }

      // Build and apply new model
      const newModelJson = buildPresetModel(preset)
      modelRef.current = Model.fromJson(newModelJson)
      saveModel(modelRef.current)
      pendingPresetRef.current = preset

      // Force re-render with new model
      setModelKey(k => k + 1)

      // After charts mount, set their widget types and symbols
      setTimeout(() => {
        const currentPreset = pendingPresetRef.current
        if (!currentPreset) return

        currentPreset.panes.forEach((pane, i) => {
          const tabId = `preset-chart-${i + 1}`

          // Set widget type
          const setWidgetFn = window.__chartSetWidgetType?.get(tabId)
          if (setWidgetFn && pane.widgetType) {
            setWidgetFn(pane.widgetType as WidgetType)
          }

          // Set symbol if specified
          const setSymbolFn = window.__chartSetSymbol?.get(tabId)
          if (setSymbolFn && pane.symbol) {
            setSymbolFn(pane.symbol)
          }
        })

        pendingPresetRef.current = null
      }, 100) // Small delay to let React mount chart components

      return true
    }

    // Expose setLayout for AI control - change to 1x1, 1x2, or 2x2 layout
    (window as any).__flexLayoutSetLayout = (layout: '1x1' | '1x2' | '2x2') => {
      // Create a simple layout preset with candlestick charts
      const paneCount = layout === '1x1' ? 1 : layout === '1x2' ? 2 : 4
      const simplePreset: LayoutPreset = {
        id: 'custom',
        label: 'Custom',
        icon: '',
        description: '',
        layout,
        panes: Array.from({ length: paneCount }, () => ({
          symbol: 'BTC-USD',
          widgetType: 'candlestick' as WidgetType,
        })),
      }

      const newModelJson = buildPresetModel(simplePreset)
      modelRef.current = Model.fromJson(newModelJson)
      saveModel(modelRef.current)
      setModelKey(k => k + 1)

      return true
    }

    return () => {
      delete (window as any).__flexLayoutAddTab
      delete (window as any).__flexLayoutSelectTab
      delete (window as any).__flexLayoutApplyPreset
      delete (window as any).__flexLayoutSetLayout
    }
  }, [])

  return (
    <div className="flex-1 min-h-0 relative">
      <Layout key={modelKey} model={modelRef.current} factory={factory} onModelChange={handleModelChange} />
    </div>
  )
}
