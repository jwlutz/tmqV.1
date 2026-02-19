import { useRef, useCallback, useEffect } from 'react'
import { Layout, Model, TabNode, IJsonModel, Actions, DockLocation } from 'flexlayout-react'
import 'flexlayout-react/style/dark.css'
import { ChartTabContent } from './ChartTabContent'
import { ChatSidebarContent } from './ChatPaneContent'
import { CodeTabContent } from './CodeTabContent'
import { BacktestResults } from '../backtest/BacktestResults'
import { RotContent } from '../rot/RotContent'
import { SECPaneContent } from './SECPaneContent'
import { useBacktest } from '../../context'

type ComponentType = 'chart' | 'chat' | 'code' | 'backtest' | 'rot' | 'sec'

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
  const modelRef = useRef<Model>(loadModel())
  const { backtestResult } = useBacktest()
  const prevResultRef = useRef<typeof backtestResult>(null)

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
    return () => { delete (window as any).__flexLayoutAddTab }
  }, [])

  return (
    <div className="flex-1 min-h-0 relative">
      <Layout model={modelRef.current} factory={factory} onModelChange={handleModelChange} />
    </div>
  )
}
