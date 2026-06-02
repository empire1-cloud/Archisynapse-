"use client"

import { useState } from "react"
import { Copy, Check, Terminal, Code, FileCode, Braces } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const SNIPPETS = [
  {
    id: "bash",
    label: "Bash",
    icon: Terminal,
    code: `curl -X POST https://archisynapse-production.up.railway.app/api/v1/transactions \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 1000, "currency": "USD", "description": "SGV Anthem generation"}'`,
  },
  {
    id: "lyrica",
    label: "Lyrica SDK",
    icon: Braces,
    code: `from archisynapse_integration import ArchisynapsePayments

payments = ArchisynapsePayments(api_key="sk_live_...")
txn = payments.charge_for_generation(
    user_handle="@shiestybizz",
    user_email="shiestybizz@example.com",
    amount_cents=299,
    track_title="SGV Anthem",
)`,
  },
  {
    id: "python",
    label: "Python",
    icon: FileCode,
    code: `import requests

API = "https://archisynapse-production.up.railway.app/api/v1"
headers = {"Authorization": "Bearer sk_live_..."}

# Semantic match
r = requests.get(f"{API}/blueprints/semantic-match", params={
    "query": "ai music generation with real-time royalties",
    "tags": "ai,music,royalties",
}, headers=headers)
print(r.json())`,
  },
  {
    id: "terraform",
    label: "Terraform",
    icon: Code,
    code: `resource "archisynapse_blueprint" "music_pipeline" {
  name        = "AI Music Pipeline"
  description = "End-to-end music generation with royalty routing"
  tags        = ["ai", "music", "royalties"]
  complexity  = "medium"
}`,
  },
]

export function CopilotPanel() {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function handleCopy(id: string, code: string) {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex flex-col h-full bg-transparent p-6 space-y-6 overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold">Copilot</h2>
        <p className="text-sm text-muted-foreground">Deployment snippets for your architecture</p>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        {SNIPPETS.map(snippet => (
          <div key={snippet.id} className="glass-panel rounded-[2rem] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <snippet.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{snippet.label}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleCopy(snippet.id, snippet.code)}>
                {copiedId === snippet.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <pre className="p-4 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre bg-black/40">
              {snippet.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
