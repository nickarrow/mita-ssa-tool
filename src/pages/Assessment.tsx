/**
 * Assessment Page
 *
 * Main page for conducting ORBIT maturity assessments.
 * Shows capability context, sidebar navigation, and dimension-based assessment flow.
 * Supports both standard capability assessments (B-I-T dimensions) and
 * organizational assessments (Outcomes/Roles with direct aspect navigation).
 */

import { JSX, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Snackbar,
} from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { getAreaWithDomain } from '../services/capabilities';
import {
  getOrbitModel,
  getTechnologySubDimensions,
  getAspectsForDimension,
  getAspectsForSubDimension,
  getAggregatedDimensionForDomain,
  getOrganizationalAspects,
} from '../services/orbit';
import { isOrganizationalAssessmentArea, getOrganizationalSections } from '../constants';
import {
  useOrbitRatings,
  useAttachments,
  useCapabilityAssessments,
  useTags,
  useScores,
} from '../hooks';
import {
  AssessmentContextBar,
  AssessmentSidebar,
  DimensionPage,
  AggregateDimensionView,
  InformationManagementNotice,
} from '../components/assessment';
import type {
  OrbitDimensionId,
  TechnologySubDimensionId,
  MaturityLevelWithNA,
  OrbitRating,
  Attachment,
  OrganizationalAssessmentId,
} from '../types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Navigation item for sidebar
 * Supports both standard dimension navigation and organizational aspect navigation
 */
interface NavItem {
  /** For standard assessments: the ORBIT dimension ID */
  dimensionId?: OrbitDimensionId;
  /** For Technology sub-dimensions */
  subDimensionId?: TechnologySubDimensionId;
  /** For organizational assessments: the section (outcomes/roles/enterprise-architecture) */
  organizationalType?: OrganizationalAssessmentId;
  /** For organizational assessments: the aspect ID being navigated to */
  aspectId?: string;
  /** Display name */
  name: string;
  /** Description text */
  description: string;
  /** Whether this item is required */
  isRequired: boolean;
  /** Number of aspects in this nav item */
  aspectCount: number;
  /** Whether this is an aggregate dimension (enterprise domains) */
  isAggregate?: boolean;
  /** Whether this is an organizational assessment nav item */
  isOrganizational?: boolean;
}

/**
 * Build navigation items for the combined organizational assessment.
 * Shows aspects directly in the sidebar instead of dimensions, iterating
 * all sections (Outcomes, Roles, Enterprise Architecture) in display order.
 * @param sections - The organizational assessment sections
 */
function buildOrganizationalNavItems(sections: OrganizationalAssessmentId[]): NavItem[] {
  return sections.flatMap((section) =>
    getOrganizationalAspects(section).map((aspect) => ({
      organizationalType: section,
      aspectId: aspect.id,
      name: aspect.name,
      description: aspect.description,
      isRequired: true,
      aspectCount: 1, // Each nav item is one aspect
      isOrganizational: true,
    }))
  );
}

/**
 * Build navigation items from ORBIT model for standard assessments
 * @param domainId - The domain ID to check for aggregate dimensions
 */
function buildStandardNavItems(domainId?: string): NavItem[] {
  const items: NavItem[] = [];
  const orbitModel = getOrbitModel();

  // Get the aggregated dimension for this domain (if any)
  const aggregatedDimension = domainId ? getAggregatedDimensionForDomain(domainId) : null;

  // Standard dimensions (B, I - non-Technology)
  for (const dimId of ['businessArchitecture', 'information'] as const) {
    const dim = orbitModel.dimensions[dimId];
    const isAggregate = aggregatedDimension === dimId;

    items.push({
      dimensionId: dimId,
      name: dim.name,
      description: isAggregate
        ? `Aggregate ${dim.name} score from all finalized capability assessments`
        : dim.description,
      isRequired: dim.required,
      // Aggregate dimensions have no manually assessable aspects
      aspectCount: isAggregate ? 0 : dim.aspects.length,
      isAggregate,
    });
  }

  // Technology dimension - check if it's aggregated
  const isTechAggregate = aggregatedDimension === 'technology';

  if (isTechAggregate) {
    // For the Technology Management domain, Technology is a single aggregate item
    const techDim = orbitModel.dimensions.technology;
    items.push({
      dimensionId: 'technology',
      name: techDim.name,
      description: 'Aggregate Technology score from all finalized capability assessments',
      isRequired: true,
      aspectCount: 0, // No aspects to assess - it's aggregate
      isAggregate: true,
    });
  } else {
    // Standard Technology with sub-dimensions
    const techSubDims = getTechnologySubDimensions();
    for (const subDim of techSubDims) {
      items.push({
        dimensionId: 'technology',
        subDimensionId: subDim.id,
        name: subDim.name,
        description: subDim.description,
        isRequired: true,
        aspectCount: subDim.aspects.length,
      });
    }
  }

  return items;
}

/**
 * Assessment page component
 */
export default function Assessment(): JSX.Element {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isViewMode = searchParams.get('view') === 'true';

  // Load assessment from DB
  const assessment = useLiveQuery(
    () => (assessmentId ? db.capabilityAssessments.get(assessmentId) : undefined),
    [assessmentId]
  );

  // Hooks for ratings, attachments, and tags
  const {
    ratings,
    saveRating,
    updateLevel,
    updateTargetLevel,
    updateNotes,
    updateBarriers,
    updatePlans,
    getAverageLevelForDimension,
    getAssessedCountForDimension,
    getOverallAverageLevel,
    getAssessedCount,
  } = useOrbitRatings(assessmentId);

  const { attachmentsByRating, uploadAttachment, deleteAttachment, downloadAttachment } =
    useAttachments(assessmentId);

  const { finalizeAssessment, updateTags } = useCapabilityAssessments();
  const { getAllTagNames } = useTags();
  const { getAggregateDimensionScore } = useScores();

  // Get capability info
  const capabilityInfo = useMemo(() => {
    if (!assessment) return null;
    return getAreaWithDomain(assessment.capabilityAreaId);
  }, [assessment]);

  // Detect if this is an organizational assessment
  const isOrganizationalAssessment = useMemo(() => {
    if (!assessment) return false;
    return isOrganizationalAssessmentArea(assessment.capabilityAreaId);
  }, [assessment]);

  const organizationalSections = useMemo(() => {
    if (!assessment) return null;
    return getOrganizationalSections(assessment.capabilityAreaId);
  }, [assessment]);

  // Navigation state - depends on assessment type and domain
  const navItems = useMemo(() => {
    if (organizationalSections) {
      return buildOrganizationalNavItems(organizationalSections);
    }
    return buildStandardNavItems(assessment?.capabilityDomainId);
  }, [assessment?.capabilityDomainId, organizationalSections]);

  const [currentNavIndex, setCurrentNavIndex] = useState(0);
  const [isReviewSelected, setIsReviewSelected] = useState(false);

  // Save status
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | undefined>();

  // Finalize dialog
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Ensure currentNav is always defined
  const currentNav = navItems[currentNavIndex] ?? navItems[0];

  // Build ratings map for current dimension/aspect
  const ratingsMap = useMemo(() => {
    const map = new Map<string, OrbitRating>();
    if (!currentNav) return map;

    for (const rating of ratings) {
      // For organizational assessments, match by organizationalType and aspectId
      if (currentNav.isOrganizational && currentNav.organizationalType && currentNav.aspectId) {
        if (
          rating.dimensionId === currentNav.organizationalType &&
          rating.aspectId === currentNav.aspectId
        ) {
          map.set(rating.aspectId, rating);
        }
      } else if (currentNav.subDimensionId) {
        // Technology sub-dimension
        if (
          rating.dimensionId === currentNav.dimensionId &&
          rating.subDimensionId === currentNav.subDimensionId
        ) {
          map.set(rating.aspectId, rating);
        }
      } else if (currentNav.dimensionId) {
        // Standard dimension (B, I)
        if (rating.dimensionId === currentNav.dimensionId && !rating.subDimensionId) {
          map.set(rating.aspectId, rating);
        }
      }
    }
    return map;
  }, [ratings, currentNav]);

  // Build attachments map for current dimension
  const attachmentsMap = useMemo(() => {
    const map = new Map<string, Attachment[]>();
    for (const rating of ratingsMap.values()) {
      const ratingAttachments = attachmentsByRating.get(rating.id) ?? [];
      map.set(rating.aspectId, ratingAttachments);
    }
    return map;
  }, [ratingsMap, attachmentsByRating]);

  // Get aspects for current dimension/organizational assessment
  const currentAspects = useMemo(() => {
    if (!currentNav) return [];

    // For organizational assessments, return just the single aspect for this nav item
    if (currentNav.isOrganizational && currentNav.organizationalType && currentNav.aspectId) {
      const aspects = getOrganizationalAspects(currentNav.organizationalType);
      const aspect = aspects.find((a) => a.id === currentNav.aspectId);
      return aspect ? [aspect] : [];
    }

    // Standard dimension navigation
    if (currentNav.subDimensionId) {
      return getAspectsForSubDimension(currentNav.subDimensionId);
    }
    if (currentNav.dimensionId) {
      return getAspectsForDimension(currentNav.dimensionId);
    }
    return [];
  }, [currentNav]);

  // Calculate sidebar progress data
  const sidebarDimensions = useMemo(() => {
    return navItems.map((nav) => {
      // For aggregate dimensions, get aggregate score data
      if (nav.isAggregate && nav.dimensionId) {
        const aggregateData = getAggregateDimensionScore(nav.dimensionId);
        return {
          dimensionId: nav.dimensionId,
          subDimensionId: nav.subDimensionId,
          name: nav.name,
          assessedCount: 0,
          totalCount: 0,
          averageScore: null,
          isRequired: nav.isRequired,
          isAggregate: true,
          aggregateScore: aggregateData.score,
          aggregateCount: aggregateData.contributingCount,
        };
      }

      // For organizational assessments, calculate progress per aspect
      if (nav.isOrganizational && nav.organizationalType && nav.aspectId) {
        const aspectRating = ratings.find(
          (r) => r.dimensionId === nav.organizationalType && r.aspectId === nav.aspectId
        );
        const isAssessed = aspectRating ? aspectRating.currentLevel !== 0 : false;
        const score =
          aspectRating && aspectRating.currentLevel > 0 ? aspectRating.currentLevel : null;

        return {
          dimensionId: nav.organizationalType as OrbitDimensionId, // Cast for sidebar compatibility
          aspectId: nav.aspectId,
          name: nav.name,
          assessedCount: isAssessed ? 1 : 0,
          totalCount: 1,
          averageScore: score,
          isRequired: nav.isRequired,
          isAggregate: false,
          isOrganizational: true,
          organizationalType: nav.organizationalType,
        };
      }

      let assessedCount = 0;
      const totalCount = nav.aspectCount;
      let avgScore: number | null = null;

      if (nav.subDimensionId) {
        // Technology sub-dimension
        const subDimRatings = ratings.filter(
          (r) => r.dimensionId === 'technology' && r.subDimensionId === nav.subDimensionId
        );
        assessedCount = subDimRatings.filter((r) => r.currentLevel !== 0).length;
        const scored = subDimRatings.filter((r) => r.currentLevel > 0);
        if (scored.length > 0) {
          avgScore = scored.reduce((sum, r) => sum + r.currentLevel, 0) / scored.length;
        }
      } else if (nav.dimensionId) {
        assessedCount = getAssessedCountForDimension(nav.dimensionId);
        avgScore = getAverageLevelForDimension(nav.dimensionId);
      }

      return {
        dimensionId: nav.dimensionId,
        subDimensionId: nav.subDimensionId,
        name: nav.name,
        assessedCount,
        totalCount,
        averageScore: avgScore,
        isRequired: nav.isRequired,
        isAggregate: false,
      };
    });
  }, [
    navItems,
    ratings,
    getAssessedCountForDimension,
    getAverageLevelForDimension,
    getAggregateDimensionScore,
  ]);

  // Calculate overall progress
  const totalAspects = navItems.reduce((sum, nav) => sum + nav.aspectCount, 0);
  const overallProgress =
    totalAspects > 0 ? Math.round((getAssessedCount() / totalAspects) * 100) : 0;

  // Auto-save indicator
  const triggerSave = useCallback(() => {
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setLastSaved(new Date());
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 300);
  }, []);

  // Tag handlers
  const handleTagAdd = useCallback(
    async (tag: string) => {
      if (!assessmentId || !assessment) return;
      const newTags = [...assessment.tags, tag];
      await updateTags(assessmentId, newTags);
      triggerSave();
    },
    [assessmentId, assessment, updateTags, triggerSave]
  );

  const handleTagRemove = useCallback(
    async (tag: string) => {
      if (!assessmentId || !assessment) return;
      const newTags = assessment.tags.filter((t) => t !== tag);
      await updateTags(assessmentId, newTags);
      triggerSave();
    },
    [assessmentId, assessment, updateTags, triggerSave]
  );

  // Rating handlers
  const handleLevelChange = useCallback(
    async (aspectId: string, level: MaturityLevelWithNA) => {
      if (!currentNav) return;
      // For organizational assessments, use organizationalType as dimensionId
      const dimId =
        currentNav.isOrganizational && currentNav.organizationalType
          ? currentNav.organizationalType
          : currentNav.dimensionId;
      if (!dimId) return;
      await updateLevel(dimId, aspectId, level, currentNav.subDimensionId);
      triggerSave();
    },
    [updateLevel, currentNav, triggerSave]
  );

  const handleTargetLevelChange = useCallback(
    async (aspectId: string, level: MaturityLevelWithNA | undefined) => {
      if (!currentNav) return;
      const dimId =
        currentNav.isOrganizational && currentNav.organizationalType
          ? currentNav.organizationalType
          : currentNav.dimensionId;
      if (!dimId) return;
      await updateTargetLevel(dimId, aspectId, level, currentNav.subDimensionId);
      triggerSave();
    },
    [updateTargetLevel, currentNav, triggerSave]
  );

  const handleQuestionChange = useCallback(
    async (aspectId: string, index: number, checked: boolean) => {
      if (!currentNav) return;
      const dimId =
        currentNav.isOrganizational && currentNav.organizationalType
          ? currentNav.organizationalType
          : currentNav.dimensionId;
      if (!dimId) return;

      const rating = ratingsMap.get(aspectId);
      const responses = [...(rating?.questionResponses ?? [])];
      const existingIndex = responses.findIndex((r) => r.questionIndex === index);

      if (existingIndex >= 0) {
        responses[existingIndex] = { questionIndex: index, answer: checked };
      } else {
        responses.push({ questionIndex: index, answer: checked });
      }

      await saveRating({
        dimensionId: dimId,
        subDimensionId: currentNav.subDimensionId,
        aspectId,
        currentLevel: rating?.currentLevel ?? 0,
        targetLevel: rating?.targetLevel,
        questionResponses: responses,
        evidenceResponses: rating?.evidenceResponses ?? [],
        notes: rating?.notes ?? '',
        barriers: rating?.barriers ?? '',
        plans: rating?.plans ?? '',
      });
      triggerSave();
    },
    [ratingsMap, saveRating, currentNav, triggerSave]
  );

  const handleEvidenceChange = useCallback(
    async (aspectId: string, index: number, checked: boolean) => {
      if (!currentNav) return;
      const dimId =
        currentNav.isOrganizational && currentNav.organizationalType
          ? currentNav.organizationalType
          : currentNav.dimensionId;
      if (!dimId) return;

      const rating = ratingsMap.get(aspectId);
      const responses = [...(rating?.evidenceResponses ?? [])];
      const existingIndex = responses.findIndex((r) => r.evidenceIndex === index);

      if (existingIndex >= 0) {
        responses[existingIndex] = { evidenceIndex: index, provided: checked };
      } else {
        responses.push({ evidenceIndex: index, provided: checked });
      }

      await saveRating({
        dimensionId: dimId,
        subDimensionId: currentNav.subDimensionId,
        aspectId,
        currentLevel: rating?.currentLevel ?? 0,
        targetLevel: rating?.targetLevel,
        questionResponses: rating?.questionResponses ?? [],
        evidenceResponses: responses,
        notes: rating?.notes ?? '',
        barriers: rating?.barriers ?? '',
        plans: rating?.plans ?? '',
      });
      triggerSave();
    },
    [ratingsMap, saveRating, currentNav, triggerSave]
  );

  const handleNotesChange = useCallback(
    async (aspectId: string, notes: string) => {
      if (!currentNav) return;
      const dimId =
        currentNav.isOrganizational && currentNav.organizationalType
          ? currentNav.organizationalType
          : currentNav.dimensionId;
      if (!dimId) return;
      await updateNotes(dimId, aspectId, notes, currentNav.subDimensionId);
      triggerSave();
    },
    [updateNotes, currentNav, triggerSave]
  );

  const handleBarriersChange = useCallback(
    async (aspectId: string, barriers: string) => {
      if (!currentNav) return;
      const dimId =
        currentNav.isOrganizational && currentNav.organizationalType
          ? currentNav.organizationalType
          : currentNav.dimensionId;
      if (!dimId) return;
      await updateBarriers(dimId, aspectId, barriers, currentNav.subDimensionId);
      triggerSave();
    },
    [updateBarriers, currentNav, triggerSave]
  );

  const handlePlansChange = useCallback(
    async (aspectId: string, plans: string) => {
      if (!currentNav) return;
      const dimId =
        currentNav.isOrganizational && currentNav.organizationalType
          ? currentNav.organizationalType
          : currentNav.dimensionId;
      if (!dimId) return;
      await updatePlans(dimId, aspectId, plans, currentNav.subDimensionId);
      triggerSave();
    },
    [updatePlans, currentNav, triggerSave]
  );

  const handleAttachmentUpload = useCallback(
    async (aspectId: string, file: File, description?: string) => {
      if (!currentNav || !assessmentId) return;
      const dimId =
        currentNav.isOrganizational && currentNav.organizationalType
          ? currentNav.organizationalType
          : currentNav.dimensionId;
      if (!dimId) return;

      const rating = ratingsMap.get(aspectId);

      if (!rating) {
        // Create a rating first if it doesn't exist
        await saveRating({
          dimensionId: dimId,
          subDimensionId: currentNav.subDimensionId,
          aspectId,
          currentLevel: 0,
        });
      }

      // Get the rating ID (may have just been created)
      // Use the appropriate compound index based on whether this is a technology sub-dimension
      let updatedRating: OrbitRating | undefined;
      if (currentNav.subDimensionId) {
        // Technology sub-dimension - use 4-part compound index
        updatedRating = await db.orbitRatings
          .where('[capabilityAssessmentId+dimensionId+subDimensionId+aspectId]')
          .equals([assessmentId, dimId, currentNav.subDimensionId, aspectId])
          .first();
      } else {
        // Non-technology dimension or organizational assessment - use 3-part compound index
        const candidates = await db.orbitRatings
          .where('[capabilityAssessmentId+dimensionId+aspectId]')
          .equals([assessmentId, dimId, aspectId])
          .toArray();
        updatedRating = candidates.find((r) => !r.subDimensionId);
      }

      if (updatedRating) {
        await uploadAttachment(updatedRating.id, file, description);
        triggerSave();
      }
    },
    [ratingsMap, saveRating, currentNav, assessmentId, uploadAttachment, triggerSave]
  );

  const handleAttachmentDelete = useCallback(
    async (_aspectId: string, attachmentId: string) => {
      await deleteAttachment(attachmentId);
      triggerSave();
    },
    [deleteAttachment, triggerSave]
  );

  // Navigation handlers
  const handleDimensionSelect = useCallback(
    (dimensionId: OrbitDimensionId, subDimensionId?: TechnologySubDimensionId) => {
      // For organizational assessments, dimensionId is actually the aspectId
      // Check if we're in organizational mode
      if (isOrganizationalAssessment) {
        // Find by aspectId (passed as dimensionId from sidebar)
        const index = navItems.findIndex(
          (nav) => nav.isOrganizational && nav.aspectId === (dimensionId as string)
        );
        if (index >= 0) {
          setCurrentNavIndex(index);
          setIsReviewSelected(false);
        }
        return;
      }

      // Standard dimension navigation
      const index = navItems.findIndex(
        (nav) => nav.dimensionId === dimensionId && nav.subDimensionId === subDimensionId
      );
      if (index >= 0) {
        setCurrentNavIndex(index);
        setIsReviewSelected(false);
      }
    },
    [navItems, isOrganizationalAssessment]
  );

  const handleReviewSelect = useCallback(() => {
    setIsReviewSelected(true);
    setFinalizeDialogOpen(true);
  }, []);

  const handleFinalize = useCallback(async () => {
    if (!assessmentId) return;
    try {
      await finalizeAssessment(assessmentId);
      setFinalizeDialogOpen(false);
      setSnackbar({
        open: true,
        message: 'Assessment finalized successfully!',
        severity: 'success',
      });
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch {
      setSnackbar({ open: true, message: 'Failed to finalize assessment', severity: 'error' });
    }
  }, [assessmentId, finalizeAssessment, navigate]);

  // Loading state
  if (!assessment || !capabilityInfo || !currentNav) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
        }}
      >
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading assessment...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Context Bar */}
      <AssessmentContextBar
        domainName={capabilityInfo.domain.name}
        areaName={capabilityInfo.area.name}
        areaDescription={capabilityInfo.area.description}
        areaTopics={capabilityInfo.area.topics}
        tags={assessment.tags}
        tagSuggestions={getAllTagNames()}
        onTagAdd={handleTagAdd}
        onTagRemove={handleTagRemove}
        onBack={() => navigate('/dashboard')}
        saveStatus={saveStatus}
        lastSaved={lastSaved}
        disabled={isViewMode}
      />

      {/* Information Management guidance (Info Mgmt pattern areas only) */}
      {capabilityInfo.area.informationManagement && <InformationManagementNotice />}

      {/* View Mode Alert */}
      {isViewMode && (
        <Alert
          severity="info"
          sx={{ borderRadius: 0 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate(`/assessment/${assessmentId}`)}
            >
              Switch to Edit
            </Button>
          }
        >
          View Mode — Changes are disabled
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <AssessmentSidebar
          overallScore={getOverallAverageLevel()}
          overallProgress={overallProgress}
          dimensions={sidebarDimensions}
          currentDimensionId={currentNav.dimensionId ?? (currentNav.aspectId as OrbitDimensionId)}
          currentSubDimensionId={currentNav.subDimensionId}
          currentAspectId={currentNav.aspectId}
          onDimensionSelect={handleDimensionSelect}
          onReviewSelect={handleReviewSelect}
          isReviewSelected={isReviewSelected}
          showFinalize={!isViewMode}
          isOrganizationalAssessment={isOrganizationalAssessment}
        />

        {/* Main Content Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {currentNav.isAggregate && currentNav.dimensionId ? (
            <AggregateDimensionView
              dimensionId={currentNav.dimensionId}
              dimensionName={currentNav.name}
              aggregateData={getAggregateDimensionScore(currentNav.dimensionId)}
            />
          ) : (
            <DimensionPage
              dimensionId={
                currentNav.dimensionId ?? (currentNav.organizationalType as OrbitDimensionId)
              }
              subDimensionId={currentNav.subDimensionId}
              dimensionName={currentNav.name}
              dimensionDescription={currentNav.description}
              isRequired={currentNav.isRequired}
              aspects={currentAspects}
              ratings={ratingsMap}
              attachments={attachmentsMap}
              onLevelChange={handleLevelChange}
              onTargetLevelChange={handleTargetLevelChange}
              onQuestionChange={handleQuestionChange}
              onEvidenceChange={handleEvidenceChange}
              onNotesChange={handleNotesChange}
              onBarriersChange={handleBarriersChange}
              onPlansChange={handlePlansChange}
              onAttachmentUpload={handleAttachmentUpload}
              onAttachmentDelete={handleAttachmentDelete}
              onAttachmentDownload={downloadAttachment}
              disabled={isViewMode}
            />
          )}
        </Box>
      </Box>

      {/* Finalize Dialog */}
      <Dialog
        open={finalizeDialogOpen}
        onClose={() => setFinalizeDialogOpen(false)}
        aria-labelledby="finalize-dialog-title"
        aria-describedby="finalize-dialog-description"
      >
        <DialogTitle id="finalize-dialog-title">Finalize Assessment?</DialogTitle>
        <DialogContent>
          <DialogContentText id="finalize-dialog-description">
            You have completed {overallProgress}% of the assessment. Finalizing will calculate your
            overall maturity score and save a snapshot for history tracking.
            {overallProgress < 100 && (
              <>
                <br />
                <br />
                <strong>Note:</strong> Some aspects are not yet assessed. You can still finalize now
                and edit later if needed.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinalizeDialogOpen(false)}>Continue Editing</Button>
          <Button onClick={handleFinalize} variant="contained" color="primary">
            Finalize Assessment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} variant="filled" role="status" aria-live="polite">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
