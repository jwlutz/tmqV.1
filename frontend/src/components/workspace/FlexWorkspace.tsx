import { useRef, useCallback, useEffect } from 'react'
import { Layout, Model, TabNode, IJsonModel, Actions, DockLocation } from 'flexlayout-react'
import 'flexlayout-react/style/dark.css'
import { ChartTabContent } from './ChartTabContent'
import { ChatSidebarContent } from './ChatPaneContent'
import { CodeTabContent } from './CodeTabContent'

type ComponentType = 'chart' | 'chat' | 'code'

// Default model: single tabset with all three tabs
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
      {
        type: 'tabset',
        weight: 100,
        id: 'main-tabset',
        children: [
          {
            type: 'tab',
            name: 'Chart',
            component: 'chart',
            id: 'tab-chart',
          },
          {
            type: 'tab',
            name: 'Chat',
            component: 'chat',
            id: 'tab-chat',
          },
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

  const handleModelChange = useCallback((model: Model) => {
    saveModel(model)
  }, [])

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
