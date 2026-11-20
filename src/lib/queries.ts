import { gql } from '@apollo/client';

export const GET_REPORT_DATA = gql`
  query GetReportData($code: String!, $fightId: Int!, $dataType: TableDataType!) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        endTime
        table(fightIDs: [$fightId], dataType: $dataType)
      }
    }
  }
`;

export const GET_PLAYER_DETAILS = gql`
  query GetPlayerDetails($code: String!, $fightId: Int!, $playerId: Int!, $dataType: TableDataType!) {
    reportData {
      report(code: $code) {
        table(fightIDs: [$fightId], dataType: $dataType, sourceID: $playerId)
      }
    }
  }
`;

export const GET_DEATHS = gql`
  query GetDeaths($code: String!, $fightId: Int!) {
    reportData {
      report(code: $code) {
        fights(fightIDs: [$fightId]) {
          startTime
        }
        table(fightIDs: [$fightId], dataType: Deaths)
      }
    }
  }
`;

export const GET_PLAYER_CASTS = gql`
  query GetPlayerCasts($code: String!, $fightId: Int!, $playerId: Int!) {
    reportData {
      report(code: $code) {
        events(fightIDs: [$fightId], dataType: Casts, sourceID: $playerId, limit: 10000) {
          data
        }
      }
    }
  }
`;

// Tudo que a análise de defensivos de um jogador precisa, numa chamada:
// casts da luta, talentos (CombatantInfo) e curas de poção/healthstone (para a qualidade).
export const GET_PLAYER_DEFENSIVE_CONTEXT = gql`
  query GetPlayerDefensiveContext($code: String!, $fightId: Int!, $playerId: Int!, $healFilter: String!) {
    reportData {
      report(code: $code) {
        casts: events(fightIDs: [$fightId], dataType: Casts, sourceID: $playerId, limit: 10000) {
          data
        }
        combatantInfo: events(fightIDs: [$fightId], dataType: CombatantInfo, sourceID: $playerId, limit: 10) {
          data
        }
        consumableHeals: events(fightIDs: [$fightId], dataType: Healing, sourceID: $playerId, filterExpression: $healFilter, limit: 1000) {
          data
        }
      }
    }
  }
`;

// Note Timer Checker: dados leves da luta (tempos, fases, elenco com classe/spec e mortes).
export const GET_NOTE_TIMER_FIGHT = gql`
  query GetNoteTimerFight($code: String!, $fightId: Int!) {
    reportData {
      report(code: $code) {
        fights(fightIDs: [$fightId]) {
          startTime
          endTime
          phaseTransitions { id startTime }
          friendlyPets { id petOwner }
        }
        playerDetails(fightIDs: [$fightId])
        deaths: table(fightIDs: [$fightId], dataType: Deaths)
      }
    }
  }
`;

// Só os casts que a note exige (filterExpression por ability.id), de todos os jogadores de uma vez.
// Paginado por nextPageTimestamp.
export const GET_NOTE_TIMER_CASTS = gql`
  query GetNoteTimerCasts($code: String!, $fightId: Int!, $filter: String!, $startTime: Float!, $endTime: Float!) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: [$fightId],
          dataType: Casts,
          hostilityType: Friendlies,
          filterExpression: $filter,
          startTime: $startTime,
          endTime: $endTime,
          limit: 10000
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

// Kick assign: interrupts bem-sucedidos de todo o elenco (id + instância do alvo, marcador, spell interrompida).
export const GET_NOTE_TIMER_INTERRUPTS = gql`
  query GetNoteTimerInterrupts($code: String!, $fightId: Int!, $startTime: Float!, $endTime: Float!) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: [$fightId],
          dataType: Interrupts,
          hostilityType: Friendlies,
          startTime: $startTime,
          endTime: $endTime,
          limit: 10000
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

// Nomes dos NPCs (para rotular o alvo do kick). Lista pequena, buscada uma vez.
export const GET_NOTE_TIMER_NPCS = gql`
  query GetNoteTimerNpcs($code: String!) {
    reportData {
      report(code: $code) {
        masterData(translate: true) {
          actors(type: "NPC") { id name }
        }
      }
    }
  }
`;

export const GET_REPORT_FIGHTS = gql`
  query GetReportFights($code: String!) {
    reportData {
      report(code: $code) {
        fights(killType: Encounters) {
          id
          name
          kill
          difficulty
          bossPercentage
          endTime
          fightPercentage
        }
      }
    }
  }
`;

export const GET_DEATH_TIMELINE = gql`
  query GetDeathTimeline($code: String!, $fightId: Int!, $playerId: Int!, $startTime: Float!, $endTime: Float!) {
    reportData {
      report(code: $code) {
        masterData(translate: true) {
          abilities {
            gameID
            name
            icon
          }
          actors {
            id
            name
            type
          }
        }
        damageTaken: events(
          fightIDs: [$fightId], 
          dataType: DamageTaken, 
          sourceID: $playerId, 
          startTime: $startTime, 
          endTime: $endTime, 
          limit: 1000
        ) {
          data
        }
        healingReceived: events(
          fightIDs: [$fightId], 
          dataType: Healing, 
          targetID: $playerId, 
          startTime: $startTime, 
          endTime: $endTime, 
          limit: 1000
        ) {
          data
        }
      }
    }
  }
`;