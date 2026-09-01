/* =====================================================================
   Optima Curriculum Studio - IMS Common Cartridge (Canvas) export + import
   Mirrors the structure of the Canvas exports the team already produces:
   assignments (with an iframe to the GitHub lesson page), quizzes (QTI 1.2),
   wiki pages, discussion topics, module structure in module_meta.xml.
   Needs JSZip (loaded from cdnjs in index.html).
   ===================================================================== */
(function (OCS) {
  const x = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const CC = 'http://canvas.instructure.com/xsd/cccv1p0';
  const CCXSI = `xmlns="${CC}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${CC} https://canvas.instructure.com/xsd/cccv1p0.xsd"`;
  const imscc = {};
  OCS.imscc = imscc;

  function id() { return OCS.uid('g'); }
  function slug(s) { return OCS.slug(s).replace(/\./g, '-dot-'); }

  /* ------------------------------------------------------------ export */
  imscc.build = async function (plan, opts = {}) {
    if (!window.JSZip) throw new Error('JSZip did not load. Check your connection and try again.');
    const zip = new JSZip();
    const courseId = id(), orgItems = [], resources = [], moduleMeta = [];
    const groupId = id();
    const title = opts.title || plan.course.title || plan.name;
    const includeMuted = !!opts.includeMuted;
    let position = 0; const stats = { assignments: 0, quizzes: 0, pages: 0, discussions: 0, headers: 0, modules: 0, skippedMuted: 0 };
    const sourceCourse = plan.course.sourceId ? OCS.data.courses[plan.course.sourceId] : null;

    // course pages (Home, Start Here, ...) from the source export, unless the teacher turned them off
    const pageIds = {};
    if (opts.includeSourcePages !== false && sourceCourse && sourceCourse.pages) {
      for (const p of sourceCourse.pages) {
        const pid = id(); pageIds[p.id] = pid;
        const fname = `wiki_content/${OCS.slug(p.title) || 'page'}-${pid.slice(1, 7)}.html`;
        zip.file(fname, wikiPage(pid, p.title, p.bodyHtml, { front: !!p.frontPage, state: p.state || 'active' }));
        resources.push(`<resource identifier="${pid}" type="webcontent" href="${fname}"><file href="${fname}"/></resource>`);
        stats.pages++;
      }
    }
    if (opts.generateHome) {
      const pid = id(); const fname = `wiki_content/course-home-${pid.slice(1, 7)}.html`;
      zip.file(fname, wikiPage(pid, 'Course Home (Curriculum Studio)', OCS.gen.courseHome(plan), { front: !Object.keys(pageIds).length, state: 'active' }));
      resources.push(`<resource identifier="${pid}" type="webcontent" href="${fname}"><file href="${fname}"/></resource>`); stats.pages++;
    }

    for (const m of plan.modules) {
      if (m.muted && !includeMuted) { stats.skippedMuted++; continue; }
      const mid = id(); position++; stats.modules++;
      const items = [];
      let ipos = 0;
      for (const it of m.items) {
        if (it.muted && !includeMuted) { stats.skippedMuted++; continue; }
        ipos++;
        const iid = id();
        const meta = OCS.kindMeta(it.kind);
        if (it.kind === 'header') {
          items.push({ iid, type: 'ContextModuleSubHeader', title: it.title, ref: null, pos: ipos }); stats.headers++; continue;
        }
        if (it.kind === 'quiz') {
          const qid = id(), depId = id();
          const questions = (it.quiz && it.quiz.questions || []).filter(q => q.include !== false);
          zip.file(`${qid}/assessment_meta.xml`, assessmentMeta(qid, it, plan, groupId, questions));
          const qti = qtiXml(qid, it.title, questions);
          zip.file(`${qid}/assessment_qti.xml`, qti);
          zip.file(`non_cc_assessments/${qid}.xml.qti`, qti);
          resources.push(`<resource identifier="${qid}" type="imsqti_xmlv1p2/imscc_xmlv1p1/assessment"><file href="${qid}/assessment_qti.xml"/><dependency identifierref="${depId}"/></resource>
<resource identifier="${depId}" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="${qid}/assessment_meta.xml"><file href="${qid}/assessment_meta.xml"/><file href="non_cc_assessments/${qid}.xml.qti"/></resource>`);
          items.push({ iid, type: 'Quizzes::Quiz', title: it.title, ref: qid, pos: ipos }); stats.quizzes++; continue;
        }
        if (it.kind === 'discussion') {
          const did = id(), dmid = id();
          zip.file(`${did}.xml`, discussionTopic(it, plan));
          zip.file(`${dmid}.xml`, topicMeta(dmid, did, it));
          resources.push(`<resource identifier="${did}" type="imsdt_xmlv1p1"><file href="${did}.xml"/><dependency identifierref="${dmid}"/></resource>
<resource identifier="${dmid}" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="${dmid}.xml"><file href="${dmid}.xml"/></resource>`);
          items.push({ iid, type: 'DiscussionTopic', title: it.title, ref: did, pos: ipos }); stats.discussions++; continue;
        }
        if (meta.canvas === 'Page' || it.kind === 'page') {
          let pid;
          if (it.kind === 'page' && it.source && sourceCourse && it.pageRef && pageIds[(sourceCourse.pages.find(p => p.file === it.pageRef) || {}).id]) {
            pid = pageIds[(sourceCourse.pages.find(p => p.file === it.pageRef) || {}).id];
          } else {
            pid = id(); const fname = `wiki_content/${slug(it.title)}-${pid.slice(1, 7)}.html`;
            zip.file(fname, wikiPage(pid, it.title, OCS.gen.canvasFragment(it, plan), { front: false, state: 'unpublished' }));
            resources.push(`<resource identifier="${pid}" type="webcontent" href="${fname}"><file href="${fname}"/></resource>`); stats.pages++;
          }
          items.push({ iid, type: 'WikiPage', title: it.title, ref: pid, pos: ipos }); continue;
        }
        // everything else is a Canvas assignment
        const aid = id(); const fname = `${aid}/${slug(it.title)}.html`;
        zip.file(fname, assignmentHtml(it, plan));
        zip.file(`${aid}/assignment_settings.xml`, assignmentSettings(aid, it, groupId, ipos));
        resources.push(`<resource identifier="${aid}" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="${fname}"><file href="${fname}"/><file href="${aid}/assignment_settings.xml"/></resource>`);
        items.push({ iid, type: 'Assignment', title: it.title, ref: aid, pos: ipos }); stats.assignments++;
      }
      orgItems.push(`<item identifier="${mid}"><title>${x(m.title)}</title>${items.map(i => i.ref ? `<item identifier="${i.iid}" identifierref="${i.ref}"><title>${x(i.title)}</title></item>` : `<item identifier="${i.iid}"><title>${x(i.title)}</title></item>`).join('')}</item>`);
      moduleMeta.push(`<module identifier="${mid}"><title>${x(m.title)}</title><workflow_state>unpublished</workflow_state><position>${position}</position><require_sequential_progress>false</require_sequential_progress><locked>false</locked><items>${items.map(i => `<item identifier="${i.iid}"><content_type>${i.type}</content_type><workflow_state>unpublished</workflow_state><title>${x(i.title)}</title>${i.ref ? `<identifierref>${i.ref}</identifierref>` : ''}<position>${i.pos}</position><new_tab>false</new_tab><indent>0</indent><link_settings_json>null</link_settings_json></item>`).join('')}</items></module>`);
    }

    zip.file('course_settings/course_settings.xml', courseSettings(courseId, title, plan));
    zip.file('course_settings/module_meta.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<modules ${CCXSI}>${moduleMeta.join('\n')}</modules>`);
    zip.file('course_settings/assignment_groups.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<assignmentGroups ${CCXSI}><assignmentGroup identifier="${groupId}"><title>Assignments</title><position>1</position><group_weight>0.0</group_weight></assignmentGroup></assignmentGroups>`);
    zip.file('course_settings/files_meta.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<fileMeta ${CCXSI}><folders/></fileMeta>`);
    zip.file('course_settings/canvas_export.txt', 'Built with Optima Curriculum Studio.\nQ: Why did the owl bring a ladder to the library?\nA: To reach the higher-order thinking.');
    resources.unshift(`<resource identifier="${courseId}" type="associatedcontent/imscc_xmlv1p1/learning-application-resource" href="course_settings/canvas_export.txt"><file href="course_settings/course_settings.xml"/><file href="course_settings/module_meta.xml"/><file href="course_settings/assignment_groups.xml"/><file href="course_settings/files_meta.xml"/><file href="course_settings/canvas_export.txt"/></resource>`);
    zip.file('imsmanifest.xml', manifest(id(), title, orgItems, resources));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { blob, stats, fileName: `${OCS.slug(title) || 'course'}-curriculum-studio.imscc` };
  };

  function manifest(mid, title, orgItems, resources) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${mid}" xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1" xmlns:lom="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource" xmlns:lomimscc="http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imscp_v1p2_v1p0.xsd http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lomresource_v1p0.xsd http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lommanifest_v1p0.xsd">
  <metadata><schema>IMS Common Cartridge</schema><schemaversion>1.1.0</schemaversion>
    <lomimscc:lom><lomimscc:general><lomimscc:title><lomimscc:string>${x(title)}</lomimscc:string></lomimscc:title></lomimscc:general>
    <lomimscc:lifeCycle><lomimscc:contribute><lomimscc:date><lomimscc:dateTime>${new Date().toISOString().slice(0, 10)}</lomimscc:dateTime></lomimscc:date></lomimscc:contribute></lomimscc:lifeCycle>
    <lomimscc:rights><lomimscc:copyrightAndOtherRestrictions><lomimscc:value>yes</lomimscc:value></lomimscc:copyrightAndOtherRestrictions><lomimscc:description><lomimscc:string>Private (Copyrighted) - Optima Academy Online</lomimscc:string></lomimscc:description></lomimscc:rights></lomimscc:lom>
  </metadata>
  <organizations><organization identifier="org_1" structure="rooted-hierarchy"><item identifier="LearningModules">${orgItems.join('\n')}</item></organization></organizations>
  <resources>
${resources.join('\n')}
  </resources>
</manifest>`;
  }
  function courseSettings(cid, title, plan) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<course identifier="${cid}" ${CCXSI}><title>${x(title)}</title><course_code>${x(plan.course.title || title)}</course_code><start_at/><conclude_at/><is_public>false</is_public><allow_student_wiki_edits>false</allow_student_wiki_edits><default_wiki_editing_roles>teachers</default_wiki_editing_roles><default_view>wiki</default_view><license>private</license><indexed>false</indexed><hide_final_grade>false</hide_final_grade><usage_rights_required>false</usage_rights_required><grading_standard_enabled>false</grading_standard_enabled><allow_student_discussion_topics>true</allow_student_discussion_topics><allow_student_discussion_editing>true</allow_student_discussion_editing><show_announcements_on_home_page>false</show_announcements_on_home_page><home_page_announcement_limit>3</home_page_announcement_limit><default_post_policy><post_manually>false</post_manually></default_post_policy></course>`;
  }
  function wikiPage(pid, title, body, { front, state }) {
    return `<html>\n<head>\n<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>\n<title>${x(title)}</title>\n<meta name="identifier" content="${pid}"/>\n<meta name="editing_roles" content="teachers"/>\n<meta name="workflow_state" content="${state || 'unpublished'}"/>\n<meta name="front_page" content="${front ? 'true' : 'false'}"/>\n<meta name="editor_type" content="rce"/>\n</head>\n<body>\n${body}\n</body>\n</html>`;
  }
  function assignmentHtml(it, plan) {
    return `<html>\n<head>\n<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>\n<title>Assignment: ${x(it.title)}</title>\n</head>\n<body>\n${OCS.gen.canvasFragment(it, plan)}\n</body>\n</html>`;
  }
  function assignmentSettings(aid, it, groupId, pos) {
    const a = it.assignment || {}; const sub = a.submissionTypes || (OCS.kindMeta(it.kind).defaultSubmission || 'online_text_entry');
    return `<?xml version="1.0" encoding="UTF-8"?>
<assignment identifier="${aid}" ${CCXSI}><title>${x(it.title)}</title><time_zone_edited>Eastern Time (US &amp; Canada)</time_zone_edited><due_at/><lock_at/><unlock_at/><module_locked>false</module_locked><assignment_group_identifierref>${groupId}</assignment_group_identifierref><workflow_state>unpublished</workflow_state><assignment_overrides></assignment_overrides><allowed_extensions></allowed_extensions><has_group_category>false</has_group_category><grading_type>${x(a.gradingType || 'points')}</grading_type>${a.points != null && a.points !== '' ? `<points_possible>${Number(a.points).toFixed(1)}</points_possible>` : ''}<all_day>false</all_day><submission_types>${x(sub)}</submission_types><position>${pos}</position><turnitin_enabled>false</turnitin_enabled><vericite_enabled>false</vericite_enabled><peer_review_count>0</peer_review_count><peer_reviews>false</peer_reviews><automatic_peer_reviews>false</automatic_peer_reviews><anonymous_peer_reviews>false</anonymous_peer_reviews><grade_group_students_individually>false</grade_group_students_individually><freeze_on_copy>false</freeze_on_copy><omit_from_final_grade>false</omit_from_final_grade><hide_in_gradebook>false</hide_in_gradebook><intra_group_peer_reviews>false</intra_group_peer_reviews><only_visible_to_overrides>false</only_visible_to_overrides><post_to_sis>false</post_to_sis><moderated_grading>false</moderated_grading><grader_count>0</grader_count><grader_comments_visible_to_graders>true</grader_comments_visible_to_graders><anonymous_grading>false</anonymous_grading><graders_anonymous_to_graders>false</graders_anonymous_to_graders><grader_names_visible_to_final_grader>true</grader_names_visible_to_final_grader><anonymous_instructor_annotations>false</anonymous_instructor_annotations><post_policy><post_manually>false</post_manually></post_policy></assignment>`;
  }
  function assessmentMeta(qid, it, plan, groupId, questions) {
    const q = it.quiz || {}; const pts = questions.reduce((s, qq) => s + (Number(qq.points) || 0), 0);
    const aid = OCS.uid('').slice(0, 32);
    return `<?xml version="1.0"?>
<quiz xmlns="${CC}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${CC} https://canvas.instructure.com/xsd/cccv1p0.xsd" identifier="${qid}">
  <title>${x(it.title)}</title>
  <description>${x(OCS.gen.quizDescription(it, plan))}</description>
  <due_at/><lock_at/><unlock_at/>
  <shuffle_questions>false</shuffle_questions><shuffle_answers>${q.shuffleAnswers ? 'true' : 'false'}</shuffle_answers><calculator_type>none</calculator_type>
  <scoring_policy>${x(q.scoringPolicy || 'keep_highest')}</scoring_policy><hide_results/>
  <quiz_type>${x(q.quizType || 'assignment')}</quiz_type>
  <points_possible>${pts.toFixed(1)}</points_possible>
  <require_lockdown_browser>false</require_lockdown_browser><require_lockdown_browser_for_results>false</require_lockdown_browser_for_results><require_lockdown_browser_monitor>false</require_lockdown_browser_monitor><lockdown_browser_monitor_data/>
  <show_correct_answers>${q.showCorrectAnswers ? 'true' : 'false'}</show_correct_answers><anonymous_submissions>false</anonymous_submissions><could_be_locked>false</could_be_locked><disable_timer_autosubmission>false</disable_timer_autosubmission>
  <allowed_attempts>${q.allowedAttempts == null ? 1 : q.allowedAttempts}</allowed_attempts><build_on_last_attempt>false</build_on_last_attempt><one_question_at_a_time>false</one_question_at_a_time><cant_go_back>false</cant_go_back><available>false</available><one_time_results>false</one_time_results><show_correct_answers_last_attempt>false</show_correct_answers_last_attempt><only_visible_to_overrides>false</only_visible_to_overrides><module_locked>false</module_locked>
  <assignment identifier="${aid}">
    <title>${x(it.title)}</title><due_at/><lock_at/><unlock_at/><module_locked>false</module_locked><workflow_state>unpublished</workflow_state><assignment_overrides/>
    <quiz_identifierref>${qid}</quiz_identifierref><allowed_extensions/><has_group_category>false</has_group_category>
    <points_possible>${pts.toFixed(1)}</points_possible><grading_type>points</grading_type><all_day>false</all_day><submission_types>online_quiz</submission_types><position>1</position>
    <turnitin_enabled>false</turnitin_enabled><vericite_enabled>false</vericite_enabled><peer_review_count>0</peer_review_count><peer_reviews>false</peer_reviews><automatic_peer_reviews>false</automatic_peer_reviews><anonymous_peer_reviews>false</anonymous_peer_reviews><grade_group_students_individually>false</grade_group_students_individually><freeze_on_copy>false</freeze_on_copy><omit_from_final_grade>false</omit_from_final_grade><intra_group_peer_reviews>false</intra_group_peer_reviews><only_visible_to_overrides>false</only_visible_to_overrides><post_to_sis>false</post_to_sis><moderated_grading>false</moderated_grading><grader_count>0</grader_count><grader_comments_visible_to_graders>true</grader_comments_visible_to_graders><anonymous_grading>false</anonymous_grading><graders_anonymous_to_graders>false</graders_anonymous_to_graders><grader_names_visible_to_final_grader>true</grader_names_visible_to_final_grader><anonymous_instructor_annotations>false</anonymous_instructor_annotations>
    <post_policy><post_manually>false</post_manually></post_policy>
    <assignment_group_identifierref>${groupId}</assignment_group_identifierref>
  </assignment>
</quiz>`;
  }
  function qtiXml(qid, title, questions) {
    const items = questions.map((q, i) => qtiItem(q, i)).join('\n');
    return `<?xml version="1.0"?>
<questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_qtiasiv1p2p1_v1p0.xsd">
  <assessment ident="${qid}" title="${x(title)}">
    <qtimetadata><qtimetadatafield><fieldlabel>cc_profile</fieldlabel><fieldentry>cc.exam.v0p1</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>qmd_assessmenttype</fieldlabel><fieldentry>Examination</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>qmd_scoretype</fieldlabel><fieldentry>Percentage</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>cc_maxattempts</fieldlabel><fieldentry>1</fieldentry></qtimetadatafield></qtimetadata>
    <section ident="root_section">
${items}
    </section>
  </assessment>
</questestinterop>`;
  }
  function qtiItem(q, i) {
    const ident = OCS.uid('').slice(0, 32); const aqRef = OCS.uid('').slice(0, 32);
    const type = q.type || (q.options ? 'multiple_choice_question' : 'essay_question');
    const prompt = q.promptHtml || `<div><p>${x(q.prompt || '')}</p></div>`;
    const meta = (extra) => `<itemmetadata><qtimetadata><qtimetadatafield><fieldlabel>question_type</fieldlabel><fieldentry>${type}</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>points_possible</fieldlabel><fieldentry>${(Number(q.points) || 1).toFixed(1)}</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>original_answer_ids</fieldlabel><fieldentry>${extra || ''}</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>assessment_question_identifierref</fieldlabel><fieldentry>${aqRef}</fieldentry></qtimetadatafield><qtimetadatafield><fieldlabel>calculator_type</fieldlabel><fieldentry>none</fieldentry></qtimetadatafield></qtimetadata></itemmetadata>`;
    const mat = `<material><mattext texttype="text/html">${x(prompt)}</mattext></material>`;
    if (type === 'matching_question' && q.pairs) {
      const choices = q.choices || [];
      const lids = q.pairs.map((p, k) => `<response_lid ident="response_${k}_${ident.slice(0, 6)}"><material><mattext texttype="text/plain">${x(p.left)}</mattext></material><render_choice>${choices.map(c => `<response_label ident="${x(c.id)}"><material><mattext>${x(c.text)}</mattext></material></response_label>`).join('')}</render_choice></response_lid>`).join('');
      const conds = q.pairs.map((p, k) => p.rightId ? `<respcondition><conditionvar><varequal respident="response_${k}_${ident.slice(0, 6)}">${x(p.rightId)}</varequal></conditionvar><setvar varname="SCORE" action="Add">${(100 / q.pairs.length).toFixed(2)}</setvar></respcondition>` : '').join('');
      return `<item ident="${ident}" title="${x(q.title || 'Question ' + (i + 1))}">${meta(choices.map(c => c.id).join(','))}<presentation>${mat}${lids}</presentation><resprocessing><outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>${conds}</resprocessing></item>`;
    }
    if (q.options && q.options.length) {
      const multi = type === 'multiple_answers_question';
      const labels = q.options.map(o => `<response_label ident="${x(o.id)}"><material><mattext texttype="text/html">${x(o.text)}</mattext></material></response_label>`).join('');
      const correct = q.correct || [];
      let cond;
      if (multi) cond = `<respcondition continue="No"><conditionvar><and>${q.options.map(o => correct.includes(o.id) ? `<varequal respident="response1">${x(o.id)}</varequal>` : `<not><varequal respident="response1">${x(o.id)}</varequal></not>`).join('')}</and></conditionvar><setvar action="Set" varname="SCORE">100</setvar></respcondition>`;
      else cond = correct.length ? `<respcondition continue="No"><conditionvar><varequal respident="response1">${x(correct[0])}</varequal></conditionvar><setvar action="Set" varname="SCORE">100</setvar></respcondition>` : '';
      return `<item ident="${ident}" title="${x(q.title || 'Question ' + (i + 1))}">${meta(q.options.map(o => o.id).join(','))}<presentation>${mat}<response_lid ident="response1" rcardinality="${multi ? 'Multiple' : 'Single'}"><render_choice>${labels}</render_choice></response_lid></presentation><resprocessing><outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes>${cond}</resprocessing></item>`;
    }
    // essay / short answer
    return `<item ident="${ident}" title="${x(q.title || 'Question ' + (i + 1))}">${meta('')}<presentation>${mat}<response_str ident="response1" rcardinality="Single"><render_fib><response_label ident="answer1" rshuffle="No"/></render_fib></response_str></presentation><resprocessing><outcomes><decvar maxvalue="100" minvalue="0" varname="SCORE" vartype="Decimal"/></outcomes><respcondition continue="No"><conditionvar><other/></conditionvar></respcondition></resprocessing></item>`;
  }
  function discussionTopic(it, plan) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<topic xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imsdt_v1p1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/imsccv1p1/imsdt_v1p1 http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imsdt_v1p1.xsd">
  <title>${x(it.title)}</title>
  <text texttype="text/html">${x(OCS.gen.canvasFragment(it, plan))}</text>
</topic>`;
  }
  function topicMeta(dmid, did, it) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<topicMeta identifier="${dmid}" ${CCXSI}><topic_id>${did}</topic_id><title>${x(it.title)}</title><position/><type>topic</type><discussion_type>side_comment</discussion_type><has_group_category>false</has_group_category><workflow_state>unpublished</workflow_state><module_locked>false</module_locked><allow_rating>false</allow_rating><only_graders_can_rate>false</only_graders_can_rate><sort_by_rating>false</sort_by_rating><todo_date/><locked>false</locked><anonymous_state>off</anonymous_state></topicMeta>`;
  }

  /* ------------------------------------------------------------ HTML packs */
  imscc.buildHtmlPack = async function (plan, { standalone = true } = {}) {
    const zip = new JSZip(); const index = [];
    let n = 0;
    plan.modules.filter(m => !m.muted).forEach((m, mi) => {
      const folder = `${String(mi + 1).padStart(2, '0')}-${OCS.slug(m.title)}`;
      const links = [];
      m.items.filter(it => !it.muted && it.kind !== 'header').forEach((it, ii) => {
        n++;
        const name = `${String(ii + 1).padStart(2, '0')}-${OCS.slug(it.title)}.html`;
        const body = it.kind === 'quiz' ? quizPreviewHtml(it, plan) : OCS.gen.canvasFragment(it, plan);
        zip.file(`${folder}/${name}`, standalone ? OCS.gen.standaloneDoc(it.title, body, plan) : body);
        links.push(`<li><a href="${folder}/${name}">${OCS.esc(it.title)}</a> <span style="color:#7A88A8;font-size:12px;">${OCS.esc(OCS.kindMeta(it.kind).label)}</span></li>`);
      });
      index.push(`<h2 style="margin:18px 0 6px;font-family:${"'Lora',Georgia,serif"};">${OCS.esc(m.title)}</h2><ol>${links.join('')}</ol>`);
    });
    zip.file('index.html', OCS.gen.standaloneDoc(plan.name, `<div style="max-width:900px;margin:0 auto;">${OCS.gen.header(plan, { title: plan.name, sub: standalone ? 'Standalone lesson pages. Open any file in a browser or upload the folder to a web host.' : 'Canvas-ready HTML fragments. Open a file, copy everything, and paste into the Canvas HTML editor.' })}<div style="background:#fff;padding:16px 20px;border:1px solid #E2E8F4;">${index.join('')}</div>${OCS.gen.footer(plan, n + ' items')}</div>`, plan));
    zip.file('README.txt', standalone
      ? 'Optima Curriculum Studio - standalone HTML pack\n\nEach file is a complete web page with the Optima header, objectives, standards, and the embedded GitHub lesson. Open index.html to browse, or host the folder anywhere.\n'
      : 'Optima Curriculum Studio - Canvas HTML pack\n\nEach file holds one Canvas-ready HTML fragment (inline styles only, iframes kept).\nIn Canvas: open the assignment or page, click the HTML editor (</>), select all, paste, Save.\n');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    return { blob, fileName: `${OCS.slug(plan.name)}-${standalone ? 'html-pages' : 'canvas-html'}.zip`, count: n };
  };
  function quizPreviewHtml(it, plan) {
    const qs = (it.quiz && it.quiz.questions || []).filter(q => q.include !== false);
    const body = qs.map((q, i) => `<div style="padding:12px 14px;border:1px solid #E2E8F4;border-radius:10px;margin:8px 0;background:#fff;"><div style="font-size:11px;color:#7A88A8;font-weight:800;text-transform:uppercase;">Question ${i + 1} · ${OCS.esc((q.type || '').replace(/_question$/, '').replace(/_/g, ' '))} · ${q.points || 1} pt</div><div style="margin:6px 0;">${q.promptHtml || OCS.esc(q.prompt)}</div>${q.options ? `<ol type="A" style="margin:4px 0 0;padding-left:22px;">${q.options.map(o => `<li style="${(q.correct || []).includes(o.id) ? 'font-weight:800;color:#1F7A4F;' : ''}">${OCS.esc(o.text)}</li>`).join('')}</ol>` : ''}${q.pairs ? `<ul style="margin:4px 0 0;">${q.pairs.map(p => `<li>${OCS.esc(p.left)} → ${OCS.esc(((q.choices || []).find(c => c.id === p.rightId) || {}).text || '?')}</li>`).join('')}</ul>` : ''}</div>`).join('');
    return `<div style="max-width:960px;margin:0 auto;font-family:'Nunito',Verdana,sans-serif;color:#0E1C42;">${OCS.gen.header(plan, { title: it.title, kicker: 'Quiz preview (answer key shown in green)', emoji: '🧠' })}<div style="padding:8px 2px;">${body}</div>${OCS.gen.footer(plan, qs.length + ' questions')}</div>`;
  }

  /* ------------------------------------------------------------ import a Canvas export */
  imscc.parse = async function (file) {
    if (!window.JSZip) throw new Error('JSZip did not load.');
    const zip = await JSZip.loadAsync(file);
    const read = async (p) => { const f = zip.file(p); return f ? await f.async('string') : null; };
    const manifest = await read('imsmanifest.xml'); if (!manifest) throw new Error('No imsmanifest.xml found. Is this a Canvas course export (.imscc)?');
    const dom = new DOMParser().parseFromString(manifest, 'application/xml');
    const titleEl = dom.getElementsByTagNameNS('*', 'string')[0];
    const settings = await read('course_settings/course_settings.xml');
    const sdom = settings ? new DOMParser().parseFromString(settings, 'application/xml') : null;
    const title = (sdom && sdom.getElementsByTagName('title')[0]?.textContent) || (titleEl && titleEl.textContent) || file.name.replace(/\.imscc$/i, '');
    const grade = (title.match(/\b(\d+)(?:st|nd|rd|th)\s+grade\b/i) || title.match(/\bgrade\s+(\d+)\b/i) || [])[1] || '';
    const subject = /math/i.test(title) ? 'math' : /social/i.test(title) ? 'social-studies' : /ela|language arts|english/i.test(title) ? 'ela' : /science/i.test(title) ? 'science' : 'other';
    const course = { schema: 'ocs-course/1', id: 'import-' + OCS.uid('').slice(0, 8), title, grade, subject, subjectLabel: { math: 'Mathematics', 'social-studies': 'Social Studies', ela: 'English Language Arts', science: 'Science' }[subject] || 'Course', imported: true, fileName: file.name, modules: [], pages: [], flStandards: [], counts: {} };
    // resources by identifier
    const res = {}; for (const r of Array.from(dom.getElementsByTagName('resource'))) res[r.getAttribute('identifier')] = { type: r.getAttribute('type'), href: r.getAttribute('href'), files: Array.from(r.getElementsByTagName('file')).map(f => f.getAttribute('href')) };
    // module structure
    const mm = await read('course_settings/module_meta.xml');
    const mods = [];
    if (mm) {
      const mdom = new DOMParser().parseFromString(mm, 'application/xml');
      for (const m of Array.from(mdom.getElementsByTagName('module'))) {
        const mod = { id: m.getAttribute('identifier'), title: m.getElementsByTagName('title')[0]?.textContent || 'Module', items: [] };
        for (const it of Array.from(m.getElementsByTagName('item'))) {
          mod.items.push({ id: it.getAttribute('identifier'), contentType: it.getElementsByTagName('content_type')[0]?.textContent || '', title: it.getElementsByTagName('title')[0]?.textContent || '', ref: it.getElementsByTagName('identifierref')[0]?.textContent || null, position: Number(it.getElementsByTagName('position')[0]?.textContent || 0), indent: 0 });
        }
        mods.push(mod);
      }
    } else {
      // plain Common Cartridge: use the organization tree
      const org = dom.getElementsByTagName('organization')[0];
      const root = org ? org.getElementsByTagName('item')[0] : null;
      if (root) for (const m of Array.from(root.children).filter(c => c.localName === 'item')) {
        const mod = { id: m.getAttribute('identifier'), title: m.getElementsByTagName('title')[0]?.textContent || 'Module', items: [] };
        for (const it of Array.from(m.children).filter(c => c.localName === 'item')) { const ref = it.getAttribute('identifierref'); const r = res[ref]; mod.items.push({ id: it.getAttribute('identifier'), contentType: r && /assessment/.test(r.type) ? 'Quizzes::Quiz' : r && r.type === 'webcontent' ? 'WikiPage' : ref ? 'Assignment' : 'ContextModuleSubHeader', title: it.getElementsByTagName('title')[0]?.textContent || '', ref, position: 0, indent: 0 }); }
        mods.push(mod);
      }
    }
    const FL = /\b((?:ELA|MA|SS|SC|HE|PE|MU|VA|DA|TH|CS|WL)\.(?:K12|K|\d{1,2})\.[A-Z]{1,4}\.\d{1,2}\.\d{1,2}|MTR\.\d\.\d)\b/g;
    const flAll = new Set();
    for (const m of mods) {
      const out = { id: m.id, title: m.title, position: mods.indexOf(m) + 1, items: [] };
      for (const it of m.items) {
        const o = { id: it.id, ref: it.ref, title: it.title, canvasType: it.contentType, kind: classify(it), position: it.position, indent: 0 };
        const code = lessonCode(it.title); if (code) o.code = code;
        if (it.contentType === 'Assignment' && it.ref) {
          const r = res[it.ref]; const htmlFile = r && r.files.find(f => /\.html$/i.test(f)); const setFile = r && r.files.find(f => /assignment_settings\.xml$/.test(f));
          const html = htmlFile ? await read(htmlFile) : ''; const set = setFile ? await read(setFile) : '';
          const src = (html.match(/<iframe[^>]*\ssrc="([^"]+)"/i) || [])[1]; const height = (html.match(/<iframe[^>]*\sheight="(\d+)"/i) || [])[1];
          let body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [])[1] || ''; const extra = body.replace(/<iframe[\s\S]*?<\/iframe>/gi, '').trim();
          o.pageUrl = src || null; o.iframeHeight = height ? Number(height) : 1200; if (extra) o.extraHtml = extra;
          o.assignment = { submissionTypes: (set.match(/<submission_types>([^<]*)/) || [])[1] || 'online_text_entry', points: Number((set.match(/<points_possible>([^<]*)/) || [])[1]) || null, gradingType: (set.match(/<grading_type>([^<]*)/) || [])[1] || 'points' };
          const codes = new Set(Array.from((html + ' ' + it.title).matchAll(FL)).map(m2 => m2[1])); if (codes.size) { o.lesson = { flCodes: Array.from(codes), objectives: [], info: [] }; codes.forEach(c => flAll.add(c)); }
          if (/placeholder|template/i.test(it.title)) o.isPlaceholder = true;
        } else if (it.contentType === 'Quizzes::Quiz' && it.ref) {
          const qti = (await read(`non_cc_assessments/${it.ref}.xml.qti`)) || (await read(`${it.ref}/assessment_qti.xml`)) || '';
          const meta = (await read(`${it.ref}/assessment_meta.xml`)) || '';
          o.quiz = { title: it.title, description: '', descriptionHtml: (meta.match(/<description>([\s\S]*?)<\/description>/) || [])[1] ? unent((meta.match(/<description>([\s\S]*?)<\/description>/) || [])[1]) : null, quizType: (meta.match(/<quiz_type>([^<]*)/) || [])[1] || 'assignment', allowedAttempts: Number((meta.match(/<allowed_attempts>([^<]*)/) || [])[1]) || 1, scoringPolicy: (meta.match(/<scoring_policy>([^<]*)/) || [])[1] || 'keep_highest', questions: parseQti(qti) };
          o.questionCount = o.quiz.questions.length;
        } else if (it.contentType === 'WikiPage' && it.ref) {
          const r = res[it.ref]; o.pageRef = r && r.href ? r.href.split('/').pop() : null;
        }
        out.items.push(o);
      }
      course.modules.push(out);
    }
    // wiki pages
    for (const [rid, r] of Object.entries(res)) if (r.type === 'webcontent' && r.href && r.href.startsWith('wiki_content/')) {
      const html = await read(r.href); if (!html) continue;
      const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || r.href; const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [])[1] || '';
      course.pages.push({ id: rid, file: r.href.split('/').pop(), title: unent(title), frontPage: /name="front_page" content="true"/.test(html), state: (html.match(/name="workflow_state" content="([^"]+)"/) || [])[1] || 'active', bodyHtml: body.trim(), chars: body.length });
    }
    course.flStandards = Array.from(flAll).sort();
    course.counts = { modules: course.modules.length, lessons: course.modules.reduce((s, m) => s + m.items.filter(i => i.kind === 'lesson').length, 0), quizzes: course.modules.reduce((s, m) => s + m.items.filter(i => i.kind === 'quiz').length, 0), pages: course.pages.length, flStandards: course.flStandards.length, videosReady: 0, videosTotal: 0 };
    return course;
  };
  function unent(s) { return String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'); }
  function classify(it) {
    const ct = it.contentType || '', t = it.title || '';
    if (ct === 'Quizzes::Quiz') return 'quiz'; if (ct === 'ContextModuleSubHeader') return 'header'; if (ct === 'WikiPage') return 'page'; if (ct === 'DiscussionTopic') return 'discussion';
    if (/spotlight/i.test(t)) return 'spotlight-vr'; if (/\bfluency\b/i.test(t)) return 'fluency'; if (/goblins|independent practice|concept check|infinite mode/i.test(t)) return 'practice'; if (/assessment|capstone|check-in|synthesis/i.test(t)) return 'assessment';
    return 'lesson';
  }
  function lessonCode(t) { let m = t.match(/\b(\d+\.\d{2}\.\d{2})\b/); if (m) return m[1]; m = t.match(/\b(\d{2}\.\d{2})\b/); if (m) return m[1]; m = t.match(/^(\d+-\d+):/); return m ? m[1] : null; }
  function parseQti(xml) {
    const out = []; if (!xml) return out;
    const dom = new DOMParser().parseFromString(xml, 'application/xml');
    for (const item of Array.from(dom.getElementsByTagName('item'))) {
      const q = { id: item.getAttribute('ident'), title: item.getAttribute('title') || '', include: true };
      for (const f of Array.from(item.getElementsByTagName('qtimetadatafield'))) { const l = f.getElementsByTagName('fieldlabel')[0]?.textContent; const v = f.getElementsByTagName('fieldentry')[0]?.textContent; if (l === 'question_type') q.type = v; if (l === 'points_possible') q.points = Number(v); }
      const pres = item.getElementsByTagName('presentation')[0]; if (!pres) continue;
      const mat = Array.from(pres.children).find(c => c.localName === 'material'); const mt = mat && mat.getElementsByTagName('mattext')[0];
      q.promptHtml = mt ? mt.textContent : ''; q.prompt = q.promptHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const lids = Array.from(pres.getElementsByTagName('response_lid'));
      const conds = Array.from(item.getElementsByTagName('varequal')).filter(v => !v.closest('not'));
      if (q.type === 'matching_question') {
        q.pairs = []; q.choices = []; const seen = new Set();
        for (const lid of lids) { const rid = lid.getAttribute('ident'); const left = Array.from(lid.children).find(c => c.localName === 'material')?.getElementsByTagName('mattext')[0]?.textContent || ''; for (const lab of Array.from(lid.getElementsByTagName('response_label'))) { const cid = lab.getAttribute('ident'); if (!seen.has(cid)) { seen.add(cid); q.choices.push({ id: cid, text: lab.getElementsByTagName('mattext')[0]?.textContent || '' }); } } const ans = conds.find(v => v.getAttribute('respident') === rid); q.pairs.push({ left, rightId: ans ? ans.textContent : null }); }
      } else if (lids.length) {
        q.options = Array.from(lids[0].getElementsByTagName('response_label')).map(lab => ({ id: lab.getAttribute('ident'), text: lab.getElementsByTagName('mattext')[0]?.textContent || '' }));
        q.correct = Array.from(new Set(conds.filter(v => v.getAttribute('respident') === 'response1').map(v => v.textContent)));
      }
      out.push(q);
    }
    return out;
  }

  /* ------------------------------------------------------------ download helper */
  imscc.download = function (blob, fileName) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  };
})(window.OCS);
