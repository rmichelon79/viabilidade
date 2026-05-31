const f = 1 / 23

function makeAbs(events, len = 90) {
  const a = new Array(len).fill(0)
  for (const [m, v] of events) if (m < len) a[m] = v
  return a
}

export const DEFAULT_PREMISSAS = {
  nome: 'ALTANA',
  endereco: 'Rua Silveiro 720 - Porto Alegre/RS',
  data: '2026-03-27',
  mesesDesenvolvimento: 6,
  prazoObra: 48,
  duracaoLancamento: 3,    // meses do período de lançamento (para distribuição de marketing)
  impostoRET: 5,         // % (UI input as %)
  inccMensal: 0.5,       // % a.m.
  permutaFinanceira: 17.0625, // % VGV
  permutaFisica: 0,      // % VGV
  aquisicaoTerreno: 0,   // % VGV
  itbiRegistro: 0.4,     // % VGV
  iptuAnual: 0.25,       // % VGV/ano
  projetos: 1.5,         // % VGV
  alvaras: 0.3,          // % VGV
  registrosInc: 0.3,     // % VGV
  seguros: 0.3,          // % VGV
  custoM2: 4000,         // R$/m²
  areaEquivalente: 8800, // m²
  custoIndireto: 15,     // % sobre custo direto
  comissoes: 5,          // % VGV
  gestaoComercial: 0,    // % VGV
  marketing: 2.5,        // % VGV
  gestaoAdm: 5,          // % VGV
  financiamentoPct: 80,  // % custo direto
  taxaJurosAA: 16,       // % a.a.
  mesInicioFinanciamento: 12,
  prazoAmortizacao: 0,
  taxaDescontoAA: 7,     // % a.a.
}

export const DEFAULT_UNIDADES = [
  { id: 'U01', tipologia: '3 Dorms 175m²', qtd: 1, areaPriv: 175, precoBase: 4417038 },
  { id: 'U02', tipologia: '3 Dorms 175m²', qtd: 1, areaPriv: 175, precoBase: 4417038 },
  { id: 'U03', tipologia: '3 Dorms 202m²', qtd: 1, areaPriv: 202, precoBase: 5101679 },
  { id: 'U04', tipologia: '3 Dorms 202m²', qtd: 1, areaPriv: 202, precoBase: 5101679 },
  { id: 'U05', tipologia: '3 Dorms 202m²', qtd: 1, areaPriv: 202, precoBase: 5101679 },
  { id: 'U06', tipologia: '3 Dorms 202m²', qtd: 1, areaPriv: 202, precoBase: 5101679 },
  { id: 'U07', tipologia: '3 Dorms 202m²', qtd: 1, areaPriv: 202, precoBase: 5106032 },
  { id: 'U08', tipologia: '3 Dorms 202m²', qtd: 1, areaPriv: 202, precoBase: 5106032 },
  { id: 'U09', tipologia: 'Cobertura 270m²', qtd: 1, areaPriv: 270, precoBase: 6814196 },
  { id: 'U10', tipologia: '3 Dorms 141m²', qtd: 1, areaPriv: 141, precoBase: 3541798 },
  { id: 'U11', tipologia: '3 Dorms 133m²', qtd: 1, areaPriv: 133, precoBase: 3359819 },
  { id: 'U12', tipologia: '3 Dorms 139m²', qtd: 1, areaPriv: 139, precoBase: 3504587 },
  { id: 'U13', tipologia: '3 Dorms 133m²', qtd: 1, areaPriv: 133, precoBase: 3337703 },
  { id: 'U14', tipologia: '3 Dorms 177m²', qtd: 1, areaPriv: 177, precoBase: 4471893 },
  { id: 'U15', tipologia: '3 Dorms 181m²', qtd: 1, areaPriv: 181, precoBase: 4556700 },
  { id: 'U16', tipologia: '3 Dorms 161m²', qtd: 1, areaPriv: 161, precoBase: 4047084 },
  { id: 'U17', tipologia: '3 Dorms 178m²', qtd: 1, areaPriv: 178, precoBase: 4497718 },
  { id: 'U18', tipologia: '3 Dorms 148m²', qtd: 1, areaPriv: 148, precoBase: 3725344 },
  { id: 'U19', tipologia: '3 Dorms 139m²', qtd: 1, areaPriv: 139, precoBase: 3494083 },
  { id: 'U20', tipologia: '3 Dorms 146m²', qtd: 1, areaPriv: 146, precoBase: 3672753 },
  { id: 'U21', tipologia: '3 Dorms 146m²', qtd: 1, areaPriv: 146, precoBase: 3672753 },
  { id: 'U22', tipologia: '3 Dorms 189m²', qtd: 1, areaPriv: 189, precoBase: 4759750 },
  { id: 'U23', tipologia: '3 Dorms 190m²', qtd: 1, areaPriv: 190, precoBase: 4800848 },
]

export const DEFAULT_CENARIOS = {
  otimista: {
    desconto: 0,
    pctEntrada: 10,
    pctObra: 60,
    pctChaves: 30,
    absorcao: makeAbs([
      [6,4*f],[8,f],[10,f],[12,f],[14,f],[16,f],[18,f],
      [20,f],[22,f],[24,f],[26,f],[28,f],[30,f],[32,f],
      [34,f],[36,f],[38,f],[40,f],[42,f],[44,f],
    ]),
  },
  base: {
    desconto: -2,
    pctEntrada: 10,
    pctObra: 60,
    pctChaves: 30,
    absorcao: makeAbs([
      [6,3*f],[8,f],[10,f],[12,f],[14,f],[16,f],[18,f],
      [20,f],[22,f],[24,f],[26,f],[28,f],[30,f],[32,f],
      [34,f],[36,f],[38,f],[40,f],[42,f],[44,f],[46,f],
    ]),
  },
  pessimista: {
    desconto: -5,
    pctEntrada: 10,
    pctObra: 60,
    pctChaves: 30,
    absorcao: makeAbs([
      [6,f],[12,f],[18,f],[24,f],[30,f],[36,f],[42,f],[48,f],
      [51,f],[57,f],[60,f],[63,f],[64,f],[65,f],
      [66,f],[69,f],[72,f],[75,f],[78,f],[81,f],[84,f],[87,f],[88,f],
    ]),
  },
}
