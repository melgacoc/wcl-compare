# Componentes de Spell Tooltip

Sistema reutilizável para exibir tooltips de habilidades do WoW em qualquer componente.

## Componentes Criados

### 1. `useSpellTooltip` (Hook)
Hook customizado para gerenciar o estado e cache de tooltips.

**Localização:** `src/hooks/useSpellTooltip.ts`

**Uso:**
```tsx
const { tooltip, showTooltip, hideTooltip } = useSpellTooltip();
```

### 2. `SpellIcon` (Componente)
Componente de ícone de habilidade com suporte a tooltip integrado.

**Localização:** `src/components/SpellIcon.tsx`

**Props:**
- `spellId: number` - ID da spell no WoW
- `icon: string` - Nome do arquivo do ícone
- `size?: 'sm' | 'md' | 'lg'` - Tamanho do ícone (padrão: 'md')
- `className?: string` - Classes CSS adicionais
- `grayscale?: boolean` - Se deve exibir em escala de cinza
- `onMouseEnter?: (spellId: number, event: React.MouseEvent) => void`
- `onMouseLeave?: () => void`

**Exemplo:**
```tsx
<SpellIcon 
  spellId={19574} 
  icon="ability_druid_ferociousbite" 
  size="md" 
  onMouseEnter={showTooltip}
  onMouseLeave={hideTooltip}
/>
```

### 3. `SpellTooltip` (Componente)
Componente que renderiza o tooltip com informações da habilidade.

**Localização:** `src/components/SpellTooltip.tsx`

**Props:**
- `spellId: number`
- `name: string`
- `icon: string`
- `html: string`
- `x: number`
- `y: number`

## Como Usar em Outros Componentes

### Passo 1: Importar o hook e componentes

```tsx
import { useSpellTooltip } from '@/hooks/useSpellTooltip';
import { SpellIcon } from '@/components/SpellIcon';
import { SpellTooltip } from '@/components/SpellTooltip';
```

### Passo 2: Usar o hook no componente

```tsx
export function MeuComponente() {
  const { tooltip, showTooltip, hideTooltip } = useSpellTooltip();
  
  return (
    <div>
      {/* Seu conteúdo */}
      <SpellIcon 
        spellId={19574} 
        icon="ability_druid_ferociousbite" 
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
      />
      
      {/* Tooltip (adicione sempre no final) */}
      {tooltip && <SpellTooltip {...tooltip} />}
    </div>
  );
}
```

### Passo 3: Para ícones customizados (sem usar SpellIcon)

Se você já tem um elemento customizado e quer apenas o tooltip:

```tsx
<img 
  src={`https://assets.rpglogs.com/img/warcraft/abilities/${iconName}.jpg`}
  onMouseEnter={(e) => showTooltip(spellId, e)}
  onMouseLeave={hideTooltip}
/>
```

## Características

- ✅ **Cache automático**: Os tooltips são buscados uma vez e armazenados em cache
- ✅ **Português brasileiro**: Tooltips exibidos em PT-BR (locale=8)
- ✅ **Ícone + Nome**: Mostra o ícone e nome da habilidade no cabeçalho
- ✅ **Estilização WoW**: CSS personalizado para cores e formatação do Wowhead
- ✅ **Performance**: Busca apenas quando necessário
- ✅ **Reutilizável**: Pode ser usado em qualquer componente

## Tamanhos Disponíveis

- `sm`: 20x20px (5 h-5)
- `md`: 32x32px (w-8 h-8) - padrão
- `lg`: 48x48px (w-12 h-12)

## Exemplo Completo

```tsx
import { useSpellTooltip } from '@/hooks/useSpellTooltip';
import { SpellIcon } from '@/components/SpellIcon';
import { SpellTooltip } from '@/components/SpellTooltip';

export function MinhaListaDeSpells() {
  const { tooltip, showTooltip, hideTooltip } = useSpellTooltip();
  
  const spells = [
    { id: 19574, icon: 'ability_druid_ferociousbite', name: 'Bestial Wrath' },
    { id: 109304, icon: 'ability_hunter_exoticmunitions', name: 'Exhilaration' },
  ];

  return (
    <div>
      <div className="flex gap-2">
        {spells.map(spell => (
          <SpellIcon
            key={spell.id}
            spellId={spell.id}
            icon={spell.icon}
            size="lg"
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
          />
        ))}
      </div>
      
      {tooltip && <SpellTooltip {...tooltip} />}
    </div>
  );
}
```
