import { useState, useEffect } from 'react'
import { Search, Plus, Edit2, Trash2, User as UserIcon, Check, X } from 'lucide-react'
import { useToast } from '@/components/common/Toast'

interface User {
  id: number
  email: string
  name: string
  role: string
  active: boolean
}

const ROLES = [
  { value: 'USER', label: 'Usuário', color: 'bg-blue-100 text-blue-800', description: 'Pode criar e gerenciar próprios cases' },
  { value: 'CURATOR', label: 'Curador', color: 'bg-teal-100 text-teal-800', description: 'Pode corrigir sugestões de tabelas' },
  { value: 'MODERATOR', label: 'Moderador', color: 'bg-purple-100 text-purple-800', description: 'Pode aprovar/rejeitar cases de outros' },
  { value: 'ADMIN', label: 'Administrador', color: 'bg-orange-100 text-orange-800', description: 'Acesso total ao sistema' },
]

export function UserManagement() {
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'USER',
  })

  // Mock data for demonstration
  useEffect(() => {
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setUsers([
        { id: 1, email: 'admin@example.com', name: 'Admin User', role: 'ADMIN', active: true },
        { id: 2, email: 'manager@example.com', name: 'Manager User', role: 'MANAGER', active: true },
        { id: 3, email: 'user@example.com', name: 'Regular User', role: 'USER', active: true },
        { id: 4, email: 'inactive@example.com', name: 'Inactive User', role: 'USER', active: false },
      ])
      setLoading(false)
    }, 500)
  }, [])

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingUser) {
      // Update
      setUsers(prev => prev.map(u => 
        u.id === editingUser.id 
          ? { ...u, ...formData }
          : u
      ))
      toast.success('Usuário atualizado com sucesso')
    } else {
      // Create
      const newUser: User = {
        id: Date.now(),
        ...formData,
        active: true,
      }
      setUsers(prev => [...prev, newUser])
      toast.success('Usuário criado com sucesso')
    }
    
    closeModal()
  }

  const handleDelete = (user: User) => {
    if (!confirm(`Tem certeza que deseja desativar ${user.name}?`)) return
    
    setUsers(prev => prev.map(u => 
      u.id === user.id ? { ...u, active: false } : u
    ))
    toast.success('Usuário desativado')
  }

  const handleToggleActive = (user: User) => {
    setUsers(prev => prev.map(u => 
      u.id === user.id ? { ...u, active: !u.active } : u
    ))
    toast.success(user.active ? 'Usuário desativado' : 'Usuário reativado')
  }

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        email: user.email,
        name: user.name,
        role: user.role,
      })
    } else {
      setEditingUser(null)
      setFormData({ email: '', name: '', role: 'USER' })
    }
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
    setFormData({ email: '', name: '', role: 'USER' })
  }

  const getRoleBadge = (role: string) => {
    const roleInfo = ROLES.find(r => r.value === role) || ROLES[0]
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${roleInfo.color}`}>
        {roleInfo.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Gestão de Usuários</h2>
          <p className="text-sm text-muted-foreground">{users.length} usuário(s) cadastrado(s)</p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo Usuário
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
        />
      </div>

      {/* Users Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">Usuário</th>
                <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">Função</th>
                <th className="px-4 py-3 text-left text-sm font-medium whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-t hover:bg-muted/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <UserIcon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{user.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{getRoleBadge(user.role)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                        user.active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {user.active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {user.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openModal(user)}
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive"
                        title="Desativar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-card border rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                  required
                  disabled={!!editingUser}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Função</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg bg-background"
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  {editingUser ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
