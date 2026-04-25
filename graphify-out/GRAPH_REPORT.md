# Graph Report - C:\Users\SAFWAN\Desktop\restaurant-order-management-system-main\restaurant-order-management-system-main  (2026-04-26)

## Corpus Check
- 14 files · ~71,217 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 77 nodes · 104 edges · 13 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `fetchOrders()` - 11 edges
2. `setAuthHeader()` - 8 edges
3. `fetchMenu()` - 6 edges
4. `fetchTables()` - 6 edges
5. `useAuth()` - 5 edges
6. `handleMergeTable()` - 4 edges
7. `handleUnmergeTable()` - 4 edges
8. `ErrorBoundary` - 3 edges
9. `useSocket()` - 3 edges
10. `StockManagerDashboard()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `ProtectedRoute()` --calls--> `useAuth()`  [INFERRED]
  C:\Users\SAFWAN\Desktop\restaurant-order-management-system-main\restaurant-order-management-system-main\src\App.tsx → C:\Users\SAFWAN\Desktop\restaurant-order-management-system-main\restaurant-order-management-system-main\src\context\AuthContext.tsx
- `RoleBasedHome()` --calls--> `useAuth()`  [INFERRED]
  C:\Users\SAFWAN\Desktop\restaurant-order-management-system-main\restaurant-order-management-system-main\src\App.tsx → C:\Users\SAFWAN\Desktop\restaurant-order-management-system-main\restaurant-order-management-system-main\src\context\AuthContext.tsx
- `useAuth()` --calls--> `useSocket()`  [INFERRED]
  C:\Users\SAFWAN\Desktop\restaurant-order-management-system-main\restaurant-order-management-system-main\src\context\AuthContext.tsx → C:\Users\SAFWAN\Desktop\restaurant-order-management-system-main\restaurant-order-management-system-main\src\hooks\useSocket.ts
- `useAuth()` --calls--> `StockManagerDashboard()`  [INFERRED]
  C:\Users\SAFWAN\Desktop\restaurant-order-management-system-main\restaurant-order-management-system-main\src\context\AuthContext.tsx → C:\Users\SAFWAN\Desktop\restaurant-order-management-system-main\restaurant-order-management-system-main\src\pages\StockManagerDashboard.tsx
- `useSocket()` --calls--> `StockManagerDashboard()`  [INFERRED]
  C:\Users\SAFWAN\Desktop\restaurant-order-management-system-main\restaurant-order-management-system-main\src\hooks\useSocket.ts → C:\Users\SAFWAN\Desktop\restaurant-order-management-system-main\restaurant-order-management-system-main\src\pages\StockManagerDashboard.tsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.29
Nodes (13): addToPosCart(), fetchOrders(), fetchTables(), handleAddTable(), handleApplyDiscount(), handleDeleteTable(), handleGlobalKeys(), handleMergeTable() (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (6): ErrorBoundary, ProtectedRoute(), RoleBasedHome(), useAuth(), StockManagerDashboard(), useSocket()

### Community 2 - "Community 2"
Cohesion: 0.2
Nodes (2): fetchSettings(), groupOrdersByTable()

### Community 3 - "Community 3"
Cohesion: 0.31
Nodes (4): fetchData(), fetchHistory(), handleAddInventory(), handleProcessAll()

### Community 4 - "Community 4"
Cohesion: 0.29
Nodes (0): 

### Community 5 - "Community 5"
Cohesion: 0.5
Nodes (0): 

### Community 6 - "Community 6"
Cohesion: 0.5
Nodes (0): 

### Community 7 - "Community 7"
Cohesion: 0.5
Nodes (4): fetchMenu(), handleAddMenuItem(), handleDeleteMenuItem(), handleToggleStock()

### Community 8 - "Community 8"
Cohesion: 0.67
Nodes (3): fetchStats(), handleMarkPaid(), resetOrders()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (3): fetchStaff(), handleGenerateStaff(), handleRemoveStaff()

### Community 10 - "Community 10"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 10`** (2 nodes): `server.ts`, `startServer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (1 nodes): `vite-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fetchOrders()` connect `Community 0` to `Community 8`, `Community 2`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `fetchMenu()` connect `Community 7` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `useAuth()` (e.g. with `ProtectedRoute()` and `RoleBasedHome()`) actually correct?**
  _`useAuth()` has 4 INFERRED edges - model-reasoned connections that need verification._