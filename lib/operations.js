export const videoUnitsFromSeconds = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  return safe ? Math.ceil(safe / 180) : 0;
};

export const staffVideoUnitsFromSeconds = (seconds) => {
  const clientUnits = videoUnitsFromSeconds(seconds);
  return clientUnits ? 0.5 + clientUnits * 0.5 : 0;
};

export const effectiveVideoUnits = (video) => {
  if (video?.approved_units !== null && video?.approved_units !== undefined) {
    return Math.max(0, Number(video.approved_units) || 0);
  }
  if (video?.calculated_units !== null && video?.calculated_units !== undefined) {
    return Math.max(0, Number(video.calculated_units) || 0);
  }
  return videoUnitsFromSeconds(video?.duration_seconds);
};

export const effectiveStaffVideoUnits = (video) => {
  if (video?.approved_staff_units !== null && video?.approved_staff_units !== undefined) {
    return Math.max(0, Number(video.approved_staff_units) || 0);
  }
  if (video?.calculated_staff_units !== null && video?.calculated_staff_units !== undefined) {
    return Math.max(0, Number(video.calculated_staff_units) || 0);
  }
  return staffVideoUnitsFromSeconds(video?.duration_seconds);
};

export const clientVideoCharge = (video, client) => {
  const units = effectiveVideoUnits(video);
  const rate = Number(client?.video_unit_price ?? 1500);
  const discount = Math.min(100, Math.max(0, Number(client?.video_discount_percent) || 0));
  return Math.round(units * rate * (1 - discount / 100) * 100) / 100;
};

export const workingDaysInMonth = (year, monthIndex) => {
  const days = new Date(year, monthIndex + 1, 0).getDate();
  let working = 0;
  for (let day = 1; day <= days; day += 1) {
    if (new Date(year, monthIndex, day).getDay() !== 0) working += 1;
  }
  return working;
};

export function compensationBreakdown(rule, metrics) {
  const base = Number(rule?.base_salary) || 0;
  const workingDays = Math.max(1, Number(metrics?.workingDays) || 1);
  const unpaidDays = Math.max(0, Number(metrics?.unpaidDays) || 0);
  const attendanceDeduction = base / workingDays * unpaidDays;

  const posts = Math.max(0, Number(metrics?.posts) || 0);
  const creatives = Math.max(0, Number(metrics?.creatives) || 0);
  const videoUnits = Math.max(0, Number(metrics?.videoUnits) || 0);
  const edits = Math.max(0, Number(metrics?.videoEdits) || 0);

  const missingPosts = Math.max(0, (Number(rule?.monthly_post_target) || 0) - posts);
  const missingCreatives = Math.max(0, (Number(rule?.monthly_creative_target) || 0) - creatives);
  const postDeduction = missingPosts * (Number(rule?.missing_post_deduction) || 0);
  const creativeDeduction = missingCreatives * (Number(rule?.missing_creative_deduction) || 0);

  const extraPosts = Math.max(0, posts - (Number(rule?.post_bonus_threshold) || 0));
  const extraCreatives = Math.max(0, creatives - (Number(rule?.monthly_creative_target) || 0));
  const extraUnits = Math.max(0, videoUnits - (Number(rule?.video_unit_bonus_threshold) || 0));

  const postIncentive = extraPosts * (Number(rule?.extra_post_rate) || 0);
  const creativeIncentive = extraCreatives * (Number(rule?.extra_creative_rate) || 0);
  const unitIncentive = extraUnits * (Number(rule?.extra_video_unit_rate) || 0);
  const editIncentive = edits * (Number(rule?.video_edit_rate) || 0);
  const sundayCompensation = Math.max(0, Number(metrics?.sundayCompensation) || 0);

  const deductions = attendanceDeduction + postDeduction + creativeDeduction;
  const incentives = postIncentive + creativeIncentive + unitIncentive + editIncentive + sundayCompensation;
  return {
    base,
    attendanceDeduction,
    postDeduction,
    creativeDeduction,
    deductions,
    postIncentive,
    creativeIncentive,
    unitIncentive,
    editIncentive,
    sundayCompensation,
    incentives,
    payable: Math.max(0, base - deductions + incentives),
    warnings: [
      missingPosts > 0 ? `${missingPosts} posting target short` : null,
      missingCreatives > 0 ? `${missingCreatives} creative target short` : null,
      unpaidDays > 0 ? `${unpaidDays} uncompensated absence day(s)` : null,
    ].filter(Boolean),
  };
}

