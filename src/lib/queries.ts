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

// --- NOVA QUERY ---
export const GET_PLAYER_DETAILS = gql`
  query GetPlayerDetails($code: String!, $fightId: Int!, $playerId: Int!, $dataType: TableDataType!) {
    reportData {
      report(code: $code) {
        table(fightIDs: [$fightId], dataType: $dataType, sourceID: $playerId)
      }
    }
  }
`;