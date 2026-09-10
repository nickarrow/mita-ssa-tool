/**
 * Aggregate Dimension View Component
 *
 * Displays aggregate score for enterprise domains where a dimension
 * is calculated from other finalized assessments rather than manually assessed.
 * Used for:
 * - Data Management: Information dimension (aggregate)
 * - Technology Management: Technology dimension (aggregate)
 */

import { JSX, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  alpha,
  useTheme,
  Theme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import type { AggregateDimensionScore } from '../../hooks';
import type { OrbitDimensionId } from '../../types';
import { formatScore } from '../../utils';

interface AggregateDimensionViewProps {
  dimensionId: OrbitDimensionId;
  dimensionName: string;
  aggregateData: AggregateDimensionScore;
}

/**
 * Get color for score
 */
function getScoreColor(score: number, theme: Theme): string {
  if (score >= 4) return theme.palette.success.main;
  if (score >= 3) return theme.palette.info.main;
  if (score >= 2) return theme.palette.warning.main;
  return theme.palette.error.main;
}

/**
 * Aggregate dimension view for enterprise domains
 */
export function AggregateDimensionView({
  dimensionId,
  dimensionName,
  aggregateData,
}: AggregateDimensionViewProps): JSX.Element {
  const theme = useTheme();
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);

  const hasData = aggregateData.score !== null && aggregateData.contributingCount > 0;

  // Group breakdown by domain for better organization
  const breakdownByDomain = aggregateData.breakdown.reduce(
    (acc, item) => {
      if (!acc[item.capabilityDomainId]) {
        acc[item.capabilityDomainId] = {
          domainName: item.capabilityDomainName,
          items: [],
        };
      }
      acc[item.capabilityDomainId]!.items.push(item);
      return acc;
    },
    {} as Record<string, { domainName: string; items: typeof aggregateData.breakdown }>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          px: 3,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BarChartIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {dimensionName}
          </Typography>
          <Chip
            label="Aggregate"
            size="small"
            color="primary"
            variant="outlined"
            sx={{ height: 22 }}
          />
        </Box>
      </Paper>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Info Alert */}
        <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 3 }}>
          <Typography variant="body2">
            This score is automatically calculated from the <strong>{dimensionName}</strong>{' '}
            dimension scores of all finalized capability assessments across other domains.
            {dimensionId === 'information' && (
              <> The Information dimension captures how data supports each capability area.</>
            )}
            {dimensionId === 'technology' && (
              <>
                {' '}
                The Technology dimension captures the tech stack supporting each capability area.
              </>
            )}
          </Typography>
        </Alert>

        {/* Score Display */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 3,
            textAlign: 'center',
            bgcolor: hasData
              ? alpha(theme.palette.primary.main, 0.05)
              : alpha(theme.palette.grey[500], 0.05),
            border: '1px solid',
            borderColor: hasData ? 'primary.light' : 'divider',
            borderRadius: 2,
          }}
        >
          {hasData ? (
            <>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1, display: 'block' }}
              >
                Aggregate Score
              </Typography>
              {/* A score value, not a section heading. `variant="h2"` alone would
                  render a real <h2> announcing "3.4" as document structure. */}
              <Typography
                variant="h2"
                component="p"
                sx={{
                  fontWeight: 700,
                  color: getScoreColor(aggregateData.score!, theme),
                  mb: 1,
                }}
              >
                {formatScore(aggregateData.score)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Based on {aggregateData.contributingCount} finalized assessment
                {aggregateData.contributingCount !== 1 ? 's' : ''}
              </Typography>
            </>
          ) : (
            <>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ mb: 1, display: 'block' }}
              >
                Aggregate Score
              </Typography>
              {/* Empty-state text, not a heading (would render <h4> under an <h2>). */}
              <Typography
                variant="h4"
                component="p"
                sx={{ fontWeight: 600, color: 'text.disabled', mb: 1 }}
              >
                No Data Available
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Complete and finalize assessments in other capability areas to see the aggregate{' '}
                {dimensionName} score here.
              </Typography>
            </>
          )}
        </Paper>

        {/* Breakdown Accordion */}
        {hasData && (
          <Accordion
            expanded={breakdownExpanded}
            onChange={(_, expanded) => setBreakdownExpanded(expanded)}
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              '&:before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="breakdown-content"
              id="breakdown-header"
            >
              {/* Inside MUI's <h3 class="MuiAccordion-heading">, so not a heading itself. */}
              <Typography variant="subtitle1" component="span" sx={{ fontWeight: 600 }}>
                Score Breakdown by Capability Area
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.grey[100], 0.5) }}>
                      <TableCell sx={{ fontWeight: 600 }}>Domain</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Capability Area</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {dimensionName} Score
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(breakdownByDomain).map(([_domainId, { domainName, items }]) =>
                      items.map((item, idx) => (
                        <TableRow
                          key={item.assessmentId}
                          sx={{
                            '&:last-child td, &:last-child th': { border: 0 },
                            bgcolor:
                              idx % 2 === 0 ? 'transparent' : alpha(theme.palette.grey[50], 0.5),
                          }}
                        >
                          <TableCell>
                            {idx === 0 ? (
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {domainName}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{item.capabilityAreaName}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 600,
                                color: getScoreColor(item.dimensionScore, theme),
                              }}
                            >
                              {formatScore(item.dimensionScore)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Additional Info */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Note:</strong> This aggregate score is included in the overall capability score
            for this assessment. As other capability assessments are finalized or updated, this
            aggregate score may change.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
