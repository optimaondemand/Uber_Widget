#!/usr/bin/env perl
# =====================================================================
#  Optima Curriculum Studio - catalog builder
#  Deconstructs Canvas IMSCC exports + the live GitHub lesson pages into
#  data/catalog.json, data/courses/<id>.json and slim library snapshots.
#
#  Usage (Git Bash / any shell with perl + unzip on PATH):
#    OCS_EXPORTS=<dir of extracted .imscc folders> \
#    OCS_PAGES=<dir with one folder per repo of downloaded lesson pages> \
#    OCS_CACHE=<dir with art.json music.json literature.json vm_<repo>.json> \
#    perl tools/build-catalog.pl
#
#  Nothing here calls an AI model. It is plain parsing of files the team
#  already publishes, so it can run on any machine with perl 5.14+.
# =====================================================================
use strict; use warnings; use utf8;
use JSON::PP;
use File::Basename qw(dirname basename);
use File::Path qw(make_path);
use File::Find qw(find);
use Cwd qw(abs_path);
use POSIX qw(strftime);
$| = 1;

my $HERE    = dirname(abs_path(__FILE__));
my $ROOT    = dirname($HERE);
my $EXPORTS = $ENV{OCS_EXPORTS} or die "Set OCS_EXPORTS to the folder holding the extracted .imscc exports\n";
my $PAGES   = $ENV{OCS_PAGES}   or die "Set OCS_PAGES to the folder holding downloaded lesson pages (one sub-folder per repo)\n";
my $CACHE   = $ENV{OCS_CACHE}   || "$HERE/.cache";
make_path("$ROOT/data/courses", "$ROOT/data/libraries", "$CACHE/xlsx");
my $JSON  = JSON::PP->new->utf8->pretty->canonical->indent_length(1);
my $TODAY = strftime('%Y-%m-%d', localtime);

# ---------------------------------------------------------------- courses
my @COURSES = (
 { id=>'g4-social-studies', dir=>'ss4', repo=>'optima-4th-social-studies', grade=>'4', subject=>'social-studies', subjectLabel=>'Social Studies', bundle=>'social-studies__4', rhythm=>'unit-lessons', accent=>'florida-historian', videoKeyPrefix=>undef },
 { id=>'g4-ela',            dir=>'4th-grade-ela-on-demand-export',  repo=>'optima-4th-ela',  grade=>'4', subject=>'ela',  subjectLabel=>'English Language Arts', bundle=>'english-language-arts__4', rhythm=>'weekly', accent=>'storyteller-gold', videoKeyPrefix=>'g4ela' },
 { id=>'g4-math',           dir=>'4th-grade-math-on-demand-export', repo=>'optima-4th-math', grade=>'4', subject=>'math', subjectLabel=>'Mathematics', bundle=>'mathematics__4', rhythm=>'unit-lessons', accent=>'math-explorer', videoKeyPrefix=>'g4math' },
 { id=>'g3-ela',            dir=>'3rd-grade-ela-on-demand-export',  repo=>'optima-3rd-ela',  grade=>'3', subject=>'ela',  subjectLabel=>'English Language Arts', bundle=>'english-language-arts__3', rhythm=>'weekly', accent=>'storyteller-gold', videoKeyPrefix=>'g3ela' },
 { id=>'g3-math',           dir=>'3rd-grade-math-on-demand-export', repo=>'optima-3rd-math', grade=>'3', subject=>'math', subjectLabel=>'Mathematics', bundle=>'mathematics__3', rhythm=>'unit-lessons', accent=>'math-explorer', videoKeyPrefix=>'g3math' },
 { id=>'g3-social-studies', dir=>'3rd-grade-social-studies-on-demand-export', repo=>'optima-3rd-social-studies', grade=>'3', subject=>'social-studies', subjectLabel=>'Social Studies', bundle=>'social-studies__3', rhythm=>'unit-lessons', accent=>'museum-gallery', videoKeyPrefix=>undef },
);

# ---------------------------------------------------------------- helpers
sub slurp { my ($p)=@_; open(my $fh,'<:raw',$p) or return undef; local $/; my $s=<$fh>; close $fh; utf8::decode($s); return $s; }
sub spew  { my ($p,$s)=@_; open(my $fh,'>:raw',$p) or die "write $p: $!"; print $fh $s; close $fh; }
sub uniq  { my %s; grep { !$s{$_}++ } @_ }
sub num   { my $v=shift; return undef unless defined $v && $v =~ /^-?\d+(\.\d+)?$/; return 0+$v }
sub tag   { my ($x,$t)=@_; return undef unless defined $x; return $1 if $x =~ /<\Q$t\E(?:\s[^>]*)?>(.*?)<\/\Q$t\E>/s; return '' if $x =~ /<\Q$t\E\/>/; return undef }
sub attrs { my $s=shift; my %h; while ($s =~ /([\w:.-]+)="([^"]*)"/g) { $h{$1}=$2 } return %h }
sub bool  { $_[0] ? JSON::PP::true : JSON::PP::false }

my %ENT = (amp=>'&', lt=>'<', gt=>'>', quot=>'"', apos=>"'", nbsp=>' ', mdash=>"\x{2014}", ndash=>"\x{2013}", hellip=>"\x{2026}",
  rsquo=>"\x{2019}", lsquo=>"\x{2018}", rdquo=>"\x{201D}", ldquo=>"\x{201C}", middot=>"\x{B7}", bull=>"\x{2022}", copy=>"\x{A9}",
  trade=>"\x{2122}", times=>"\x{D7}", deg=>"\x{B0}", rarr=>"\x{2192}", larr=>"\x{2190}", eacute=>"\x{E9}", ntilde=>"\x{F1}", iacute=>"\x{ED}", oacute=>"\x{F3}", aacute=>"\x{E1}", uacute=>"\x{FA}");
sub unent {
  my $s=shift; return '' unless defined $s;
  $s =~ s/&#x([0-9a-fA-F]+);/chr(hex($1))/ge;
  $s =~ s/&#(\d+);/chr($1)/ge;
  $s =~ s/&([a-zA-Z]+);/exists $ENT{$1} ? $ENT{$1} : "&$1;"/ge;
  return $s;
}
sub text_of {
  my $h=shift; return '' unless defined $h;
  $h =~ s/<script\b.*?<\/script>//gsi; $h =~ s/<style\b.*?<\/style>//gsi; $h =~ s/<!--.*?-->//gs;
  $h =~ s/<br\s*\/?>/ /gi; $h =~ s/<\/(p|div|li|h\d|tr|td|th)>/ /gi; $h =~ s/<[^>]+>/ /g;
  $h = unent($h); $h =~ s/\s+/ /g; $h =~ s/^\s+|\s+$//g; return $h;
}
# strip leading emoji / symbol decorations from labels
sub clean_label { my $t = text_of(shift); $t =~ s/^[\p{So}\p{Sk}\p{Cf}\x{FE0F}\x{200D}\x{20E3}\s\x{2B50}\x{2705}\x{2714}\x{2713}]+//; $t =~ s/\s+/ /g; return $t }

# ---------------------------------------------------------------- IMSCC parsing
sub course_settings {
  my ($dir)=@_; my $x = slurp("$dir/course_settings/course_settings.xml") // '';
  my $c = slurp("$dir/course_settings/context.xml") // '';
  return { title=>unent(tag($x,'title')//''), courseCode=>unent(tag($x,'course_code')//''), canvasCourseId=>tag($c,'course_id'), canvasDomain=>tag($c,'canvas_domain') };
}
sub parse_modules {
  my ($dir)=@_; my $x = slurp("$dir/course_settings/module_meta.xml") // ''; my @mods;
  while ($x =~ /<module identifier="([^"]+)">(.*?)<\/module>/gs) {
    my ($id,$body)=($1,$2);
    my %m = (id=>$id, title=>unent(tag($body,'title')//''), state=>tag($body,'workflow_state'), position=>0+(tag($body,'position')||0), items=>[]);
    while ($body =~ /<item identifier="([^"]+)">(.*?)<\/item>/gs) {
      my ($iid,$ib)=($1,$2);
      push @{$m{items}}, { id=>$iid, contentType=>tag($ib,'content_type'), title=>unent(tag($ib,'title')//''), ref=>tag($ib,'identifierref'),
        position=>0+(tag($ib,'position')||0), indent=>0+(tag($ib,'indent')||0), state=>tag($ib,'workflow_state') };
    }
    push @mods, \%m;
  }
  return \@mods;
}
sub files_in { my ($d)=@_; opendir(my $dh,$d) or return (); my @f = grep { !/^\./ } readdir $dh; closedir $dh; return @f }
sub parse_assignment {
  my ($dir,$ref)=@_; my $d = "$dir/$ref"; return undef unless -d $d;
  my $s = slurp("$d/assignment_settings.xml") // '';
  my ($htmlName) = grep { /\.html$/ } files_in($d);
  my $h = defined $htmlName ? (slurp("$d/$htmlName") // '') : '';
  my $body = $h =~ /<body[^>]*>(.*?)<\/body>/si ? $1 : $h;
  my ($src)    = $body =~ /<iframe[^>]*\ssrc="([^"]+)"/i;
  my ($height) = $body =~ /<iframe[^>]*\sheight="(\d+)"/i;
  my $extra = $body; $extra =~ s/<iframe\b.*?<\/iframe>//gsi; $extra =~ s/<p>\s*<\/p>//g; $extra =~ s/^\s+|\s+$//g;
  return {
    title=>unent(tag($s,'title')//''), submissionTypes=>tag($s,'submission_types')//'', points=>num(tag($s,'points_possible')),
    gradingType=>tag($s,'grading_type')//'points', iframeSrc=>$src, iframeHeight=>($height?0+$height:undef),
    extraHtml=>($extra ne '' ? $extra : undef), pageFile=>($src ? (split m{/}, $src)[-1] : undef),
    repoFromSrc=>(($src && $src =~ m{github\.io/([^/]+)/}) ? $1 : undef), fileName=>$htmlName,
  };
}
sub parse_qti_items {
  my ($xml)=@_; my @items; return \@items unless defined $xml;
  while ($xml =~ /<item ident="([^"]+)"(?: title="([^"]*)")?>(.*?)<\/item>/gs) {
    my ($id,$title,$b)=($1,$2,$3);
    my %q=(id=>$id, title=>unent($title//''));
    $q{type}   = $b =~ /<fieldlabel>question_type<\/fieldlabel>\s*<fieldentry>([^<]*)</ ? $1 : 'unknown';
    $q{points} = $b =~ /<fieldlabel>points_possible<\/fieldlabel>\s*<fieldentry>([^<]*)</ ? 0+$1 : undef;
    my ($pres) = $b =~ /<presentation>(.*?)<\/presentation>/s; $pres //= '';
    my ($prompt) = $pres =~ /^\s*<material>\s*<mattext[^>]*>(.*?)<\/mattext>/s;
    $q{promptHtml} = unent($prompt//''); $q{prompt} = text_of($q{promptHtml});
    my $resp = $b; $resp =~ s/<not>.*?<\/not>//gs;
    my @lids = $pres =~ /(<response_lid .*?<\/response_lid>)/gs;
    if ($q{type} eq 'matching_question') {
      my (@pairs,@choices,%seen);
      for my $lid (@lids) {
        my ($rid)  = $lid =~ /<response_lid ident="([^"]+)"/;
        my ($left) = $lid =~ /^<response_lid[^>]*>\s*<material>\s*<mattext[^>]*>(.*?)<\/mattext>/s;
        while ($lid =~ /<response_label ident="([^"]+)">\s*<material>\s*<mattext[^>]*>(.*?)<\/mattext>/gs) { push @choices, {id=>$1, text=>text_of(unent($2))} unless $seen{$1}++ }
        my ($ans) = $resp =~ /<varequal respident="\Q$rid\E">([^<]+)<\/varequal>/;
        push @pairs, { left=>text_of(unent($left//'')), rightId=>$ans };
      }
      $q{pairs}=\@pairs; $q{choices}=\@choices;
    } elsif (@lids) {
      my @opts; my $lid = $lids[0];
      while ($lid =~ /<response_label ident="([^"]+)">\s*<material>\s*<mattext[^>]*>(.*?)<\/mattext>/gs) { push @opts, {id=>$1, text=>text_of(unent($2))} }
      $q{options}=\@opts;
      my @correct = $resp =~ /<varequal respident="response1">([^<]+)<\/varequal>/g;
      $q{correct}=[ uniq(@correct) ];
    }
    push @items, \%q;
  }
  return \@items;
}
sub parse_quiz {
  my ($dir,$ref)=@_; my $d="$dir/$ref"; return undef unless -d $d;
  my $m = slurp("$d/assessment_meta.xml") // '';
  my $qti = slurp("$dir/non_cc_assessments/$ref.xml.qti") // slurp("$d/assessment_qti.xml");
  my $desc = unent(tag($m,'description')//'');
  return {
    title=>unent(tag($m,'title')//''), descriptionHtml=>($desc ne '' ? $desc : undef), description=>text_of($desc),
    quizType=>tag($m,'quiz_type')//'assignment', points=>num(tag($m,'points_possible')), allowedAttempts=>num(tag($m,'allowed_attempts')),
    scoringPolicy=>tag($m,'scoring_policy'), shuffleAnswers=>bool((tag($m,'shuffle_answers')//'false') eq 'true'),
    showCorrectAnswers=>bool((tag($m,'show_correct_answers')//'false') eq 'true'),
    questions=>parse_qti_items($qti),
  };
}
sub parse_wiki_pages {
  my ($dir)=@_; my @pages; my $wd="$dir/wiki_content"; return \@pages unless -d $wd;
  for my $f (sort(files_in($wd))) { next unless $f =~ /\.html$/; my $h = slurp("$wd/$f") // next;
    my %meta; while ($h =~ /<meta name="([^"]+)" content="([^"]*)"\/?>/g) { $meta{$1}=$2 }
    my ($title) = $h =~ /<title>(.*?)<\/title>/s; my ($body) = $h =~ /<body[^>]*>(.*?)<\/body>/si;
    $body //= ''; $body =~ s/^\s+|\s+$//g;
    push @pages, { file=>$f, id=>$meta{identifier}, title=>unent($title//$f), frontPage=>bool(($meta{front_page}//'') eq 'true'),
      state=>$meta{workflow_state}, editorType=>$meta{editor_type}, bodyHtml=>$body, chars=>length($body) };
  }
  return \@pages;
}
sub list_resources {
  my ($dir)=@_; my @out; my $wr="$dir/web_resources"; return \@out unless -d $wr;
  find({ no_chdir=>1, wanted=>sub { return unless -f $_; my $rel=$_; $rel =~ s/^\Q$wr\E\/?//; push @out, { path=>$rel, bytes=>(-s $_) } } }, $wr);
  return [ sort { $a->{path} cmp $b->{path} } @out ];
}

# ---------------------------------------------------------------- lesson page parsing
my $FLCODE = qr/\b((?:ELA|MA|SS|SC|HE|PE|MU|VA|DA|TH|CS|WL)\.(?:K12|K|\d{1,2})\.[A-Z]{1,4}\.\d{1,2}\.\d{1,2}|MA\.K12\.MTR\.\d\.\d|MTR\.\d\.\d)\b/;
# Texas codes appear on pages as "4.8.B" (ELA/math) or "TEKS §113.15 · 6(A)–(B)" (social studies).
# The standards browser stores them as 110.6(b)(8)(B) / 113.15(c)(6)(A), so normalize to that shape.
my %TEKS_SECTION = ( 'ela|3'=>'110.5(b)', 'ela|4'=>'110.6(b)', 'ela|5'=>'110.7(b)', 'math|3'=>'111.5(b)', 'math|4'=>'111.6(b)', 'math|5'=>'111.7(b)',
                     'social-studies|3'=>'113.14(c)', 'social-studies|4'=>'113.15(c)', 'social-studies|5'=>'113.16(c)' );
sub normalize_tx {
  my ($raw,$subject,$grade)=@_; my @out; my $sec = $TEKS_SECTION{"$subject|$grade"};
  if ($raw =~ /^\s*(\d+)\.(\d+)\.([A-Z])\s*$/ && $sec) { push @out, "$sec($2)($3)"; return @out }
  if ($raw =~ /(\d{3}\.\d+)/) { my $s=$1; my $sub = ($s =~ /^113\./) ? 'c' : 'b';
    while ($raw =~ /(\d+)\(([A-Z])\)(?:\s*[\x{2013}\x{2014}-]\s*\(?([A-Z])\)?)?/g) { my ($n,$a,$b)=($1,$2,$3);
      if ($b) { for my $l (ord($a)..ord($b)) { push @out, "$s($sub)($n)(".chr($l).")" } } else { push @out, "$s($sub)($n)($a)" } }
    return @out }
  return ();
}
sub slot_type {
  my $s = lc(shift // ''); return 'Teacher Welcome' if $s =~ /welcome/; return 'Core Lesson' if $s =~ /explore|core|teach/; return 'Assignment Explainer' if $s =~ /assignment/;
  return 'Closing' if $s =~ /closing|wrap/; return 'Quiz Celebration' if $s =~ /perfect/; return 'Quiz Review' if $s =~ /review/; return 'Lesson Video';
}
sub parse_lesson_page {
  my ($h)=@_; my %L;
  my ($t) = $h =~ /<title>(.*?)<\/title>/s; $t = text_of($t//''); $t =~ s/^Optima Academy Online\s*[\x{2014}\x{2013}-]\s*//; $L{pageTitle}=$t;
  my @cells;
  # header strip: each label is followed by its value (and sometimes a detail line)
  while ($h =~ /class="info-label"[^>]*>(.*?)<\/div>\s*<div class="info-value"[^>]*>(.*?)<\/div>(?:\s*<div class="info-detail"[^>]*>(.*?)<\/div>)?/gs) {
    my ($lab,$val,$det)=($1,$2,$3);
    push @cells, { label=>clean_label($lab), value=>text_of($val), ($det ? (detail=>text_of($det)) : ()) };
  }
  $L{info}=\@cells;
  $L{objectives} = [ grep { length } map { clean_label($_) } $h =~ /<div class="obj-line">(.*?)<\/div>/gs ];
  $L{needs}      = [ grep { length } map { clean_label($_) } $h =~ /<[a-z]+ class="need-chip"[^>]*>(.*?)<\/[a-z]+>/gs ];
  my (%fl,%tx);
  $fl{text_of($_)}=1 for $h =~ /class="fl-code"[^>]*>(.*?)<\//gs;
  $tx{text_of($_)}=1 for $h =~ /class="tx-code"[^>]*>(.*?)<\//gs;
  my $cut = index($h, 'class="tab-panel"'); my $head = $cut > 0 ? substr($h,0,$cut) : substr($h,0,90000);
  $fl{$_}=1 for $head =~ /$FLCODE/g;
  for my $x ($head =~ /class="tx-standards[^"]*"[^>]*>(.*?)<\/div>/gs) { my $s=text_of($x); $tx{$s}=1 if length $s }
  delete $fl{''}; delete $tx{''};
  $L{flCodes}=[sort keys %fl]; $L{txCodes}=[sort keys %tx];
  my @kc; while ($h =~ /<div class="key-concept"[^>]*>(.{0,2500}?)<\/div>\s*<\/div>/gs) { my $s=text_of($1); $s =~ s/^\W*Key Concept\W*//i; push @kc, $s if length $s > 8 }
  $L{keyConcepts}=[ uniq(@kc) ];
  my ($vl) = $h =~ /class="virtue-label"[^>]*>(.*?)<\//s; my ($vt) = $h =~ /class="virtue-text"[^>]*>(.*?)<\//s;
  if ($vl || $vt) { my $lab=clean_label($vl); $lab =~ s/^Virtue Spotlight\W*//i; $L{virtue}={ label=>$lab, text=>text_of($vt) } }
  if ($h =~ /<div class="intro-card theme-question"[^>]*>(.*?)<div class="intro-card theme-objectives"/s) {
    my $txt = clean_label($1);
    # drop card labels such as "Mission Question", "Today's Mission", "Essential Question", "Big Question"
    for (1..3) { last unless $txt =~ s/^.*?\b(?:Mission Question|Today'?s Mission|Essential Question|Big Question|Focus Question|Today'?s Focus|Question of the Day)\s*//i }
    $txt = clean_label($txt);
    $txt =~ s/\b(Mrs|Mr|Ms|Dr|St|Jr|Sr|vs|etc|Capt|Gen|Col|Lt|Sgt|Prof|Rev|No)\./$1\x{2024}/g;   # protect abbreviations from the sentence split
    my @qs = $txt =~ /([^.?!]*\?)/g; my $q = @qs ? $qs[-1] : $txt; $q =~ s/\x{2024}/./g; $q =~ s/^\s+//; $q = clean_label($q);
    $L{missionQuestion}=$q if length $q > 8;
  }
  # video slots: wrapper blocks first (social studies), then bare slot markers (ELA, math)
  my @slots; my %seenSlot; my @starts; while ($h =~ /<div class="video-wrap"[^>]*>/g) { push @starts, pos($h) - length($&) }
  for my $i (0..$#starts) { my $end = $i < $#starts ? $starts[$i+1] : $starts[$i]+4000; my $blk = substr($h,$starts[$i],$end-$starts[$i]);
    my ($type)=$blk =~ /class="video-wrap-type"[^>]*>(.*?)<\/div>/s; my ($ttl)=$blk =~ /class="video-wrap-title"[^>]*>(.*?)<\/div>/s;
    my ($slot)=$blk =~ /slot:\s*([0-9A-Za-z_-]+)/; ($slot)=$blk =~ /data-video-slot="([^"]+)"/ unless $slot;
    my ($src)=$blk =~ /<iframe[^>]*\ssrc="([^"]+)"/i;
    if ($slot || $ttl) { push @slots, { slot=>$slot, type=>clean_label($type) || slot_type($slot), title=>text_of($ttl), ($src ? (embeddedSrc=>$src) : ()) }; $seenSlot{$slot}=1 if $slot } }
  my @bare = ($h =~ /<!--\s*slot:\s*([0-9A-Za-z_-]+)\s*-->/g, $h =~ /data-video-slot="([0-9A-Za-z_-]+)"/g);
  for my $s (uniq(@bare)) { next if $seenSlot{$s}++; next if $s =~ /^\[/; push @slots, { slot=>$s, type=>slot_type($s), title=>'' } }
  $L{videoSlots}=\@slots;
  $L{tabs} = [ map { my $s=clean_label($_); $s =~ s/\s*\x{2713}$//; $s } $h =~ /<button class="tab-btn[^"]*"[^>]*>(.*?)<\/button>/gs ];
  my $body = $h =~ /<body[^>]*>(.*)<\/body>/si ? $1 : $h;
  my @words = split /\s+/, text_of($body);
  $L{counts} = { activities=>scalar(()=$h =~ /class="activity-head"/g), journals=>scalar(()=$h =~ /class="journal-box"/g),
                 selfCheckQuestions=>scalar(()=$h =~ /class="quiz-q"/g), fluencyItems=>scalar(()=$h =~ /class="fluency-item"/g),
                 videoSlots=>scalar(@slots), words=>scalar(@words) };
  $L{features} = { readAloud=>bool($h =~ /optima-read-aloud/), progressBar=>bool($h =~ /progress-wrap/), texasSidebar=>bool($h =~ /Meanwhile in Texas/), autosaveJournals=>bool($h =~ /autoSave\(/) };
  $L{bytes}=length($h);
  return \%L;
}

# ---------------------------------------------------------------- xlsx planning tables
sub colnum { my $s=shift; my $n=0; $n = $n*26 + (ord($_)-64) for split //, $s; return $n-1 }
# Some workbooks (openpyxl) write plain tags, others (Open XML SDK) prefix every tag with x: and
# keep strings inline. $P makes every tag match with or without a namespace prefix.
my $P = qr/(?:[A-Za-z_][\w.-]*:)?/;
sub xlsx_sheets {
  my ($xlsx,$cacheDir)=@_; make_path($cacheDir);
  system('unzip','-o','-q',$xlsx,'-d',$cacheDir) == 0 or do { warn "unzip failed for $xlsx\n"; return [] };
  my $wb = slurp("$cacheDir/xl/workbook.xml") // return [];
  my @sheets; while ($wb =~ /<${P}sheet\s([^>]*?)\/?>/g) { my %a = attrs($1); my ($ridKey) = grep { /(^|:)id$/ } keys %a; push @sheets, { name=>unent($a{name}//''), rid=>($ridKey ? $a{$ridKey} : undef) } }
  my $rels = slurp("$cacheDir/xl/_rels/workbook.xml.rels") // ''; my %target;
  while ($rels =~ /<${P}Relationship\s([^>]*?)\/?>/g) { my %a=attrs($1); $target{$a{Id}}=$a{Target} if $a{Id} }
  my $ss = slurp("$cacheDir/xl/sharedStrings.xml") // ''; my @strings;
  while ($ss =~ /<${P}si>(.*?)<\/${P}si>/gs) { my $si=$1; push @strings, join('', map { unent($_) } $si =~ /<${P}t[^>]*>(.*?)<\/${P}t>/gs) }
  for my $sh (@sheets) {
    my $t = $target{$sh->{rid}//''} // next; $t =~ s{^/}{}; $t = "xl/$t" unless $t =~ m{^xl/};
    my $x = slurp("$cacheDir/$t") // next; my @rows;
    while ($x =~ /<${P}row\s[^>]*>(.*?)<\/${P}row>/gs) { my $r=$1; my @cells;
      while ($r =~ /<${P}c\s([^>]*?)(?:\/>|>(.*?)<\/${P}c>)/gs) { my ($a,$inner)=($1,$2); my %at=attrs($a); my $col = ($at{r}//'') =~ /^([A-Z]+)/ ? colnum($1) : scalar(@cells); my $v;
        my $ty = $at{t}//'';
        if ($ty eq 's') { my ($i)=($inner//'') =~ /<${P}v>(\d+)<\/${P}v>/; $v = defined $i ? $strings[$i] : '' }
        elsif ($ty eq 'inlineStr') { $v = join('', map { unent($_) } ($inner//'') =~ /<${P}t[^>]*>(.*?)<\/${P}t>/gs) }
        else { ($v)=($inner//'') =~ /<${P}v>(.*?)<\/${P}v>/s; $v = unent($v//'') }
        $cells[$col]=$v }
      push @rows, [ map { defined $_ ? $_ : '' } @cells ] }
    $sh->{rows}=\@rows;
  }
  return \@sheets;
}
sub header_map { my ($row)=@_; my %m; for my $i (0..$#$row) { my $k = $row->[$i]; next unless defined $k && length $k; $k =~ s/\s+/ /g; $m{$k}=$i } return %m }
sub find_xlsx { my ($dir)=@_; my @f; find({no_chdir=>1, wanted=>sub { push @f, $_ if -f $_ && /\.xlsx$/i && m{Scope and Sequence} }}, "$dir/web_resources") if -d "$dir/web_resources"; return $f[0] }
# "MA.3.NSO.1.1-1.4; MTR.2.1, MTR.5.1" -> individual codes (ranges expanded when the strand matches)
sub expand_codes {
  my ($s)=@_; my @out; return @out unless defined $s;
  for my $tok (split /\s*[;,]\s*/, $s) { $tok =~ s/^\s+|\s+$//g; next unless length $tok; next if $tok =~ /\.x$/i;   # "MA.4.NSO.1.x" is a wildcard, not a code
    if ($tok =~ /^(.*?\.)(\d+)\.(\d+)\s*[-\x{2013}]\s*(\d+)\.(\d+)$/) { my ($pre,$a1,$b1,$a2,$b2)=($1,$2,$3,$4,$5);
      if ($a1 == $a2 && $b2 >= $b1 && $b2-$b1 < 30) { push @out, "$pre$a1.$_" for $b1..$b2 } else { push @out, "$pre$a1.$b1", "$pre$a2.$b2" } }
    elsif ($tok =~ /^(.*?\.)(\d+)\s*[-\x{2013}]\s*(\d+)$/) { my ($pre,$a,$b)=($1,$2,$3); if ($b >= $a && $b-$a < 30) { push @out, "$pre$_" for $a..$b } else { push @out, "$pre$a", "$pre$b" } }
    elsif ($tok =~ /^[A-Z]{1,4}(?:\.[A-Za-z0-9]+)+$/) { push @out, $tok }
  }
  return uniq(@out);
}
my %PLAN_ALIAS = ( oaoSocialStudiesRoutine=>'routine', virtueLens=>'virtue', crossCurricularConnection=>'crossCurricular', standardsFocus=>'standards',
  independentEvidenceAssignmentFocus=>'evidence', independentEvidenceAssessmentFocus=>'evidence', sourceNotes=>'sources', classicalLearningMode=>'mode',
  socraticQuestionFocus=>'socratic', spiraledSkillTarget=>'skill', studentThinkingMove=>'thinkingMove', skillEvidenceToCarryForward=>'carryForward',
  unitArcPosition=>'unitArc', primaryCpaModelEmphasis=>'cpaModel' );
sub camel { my $k=shift; my @w = grep { length } split /[^A-Za-z0-9]+/, $k; return '' unless @w; my $s = lc shift @w; $s .= ucfirst lc $_ for @w; return $s }
# Any sheet with a "Lesson Code" column (social studies and math planning tables) -> { lessonCode => record }
sub planning_table {
  my ($xlsx,$cacheDir)=@_; my %out; return \%out unless $xlsx;
  for my $sh (@{ xlsx_sheets($xlsx,$cacheDir) }) {
    my $rows=$sh->{rows}; my $hi; for my $i (0..($#$rows<40?$#$rows:40)) { if (grep { defined $_ && /^Lesson Code$/ } @{$rows->[$i]}) { $hi=$i; last } } next unless defined $hi;
    my %h = header_map($rows->[$hi]);
    for my $r (@{$rows}[$hi+1..$#$rows]) { my $code = $r->[$h{'Lesson Code'}] // ''; next unless $code =~ /^\d+\.\d+\.\d+$/; my %rec;
      for my $name (keys %h) { my $v = $r->[$h{$name}]; next unless defined $v && length $v; my $k = camel($name); next unless length $k; $k = $PLAN_ALIAS{$k} // $k; $rec{$k} = $v }
      $rec{standardsList} = [ expand_codes($rec{standards}) ];
      $out{$code}=\%rec }
    last;
  }
  return \%out;
}
sub planning_ela {  # returns { weekNumber => {...} }
  my ($xlsx,$cacheDir)=@_; my %out; return \%out unless $xlsx;
  for my $sh (@{ xlsx_sheets($xlsx,$cacheDir) }) {
    my $rows=$sh->{rows}; my $hi; for my $i (0..($#$rows<10?$#$rows:10)) { my $row=$rows->[$i]; if ((grep { defined $_ && /^Week$/ } @$row) && (grep { defined $_ && /Standards/ } @$row)) { $hi=$i; last } } next unless defined $hi;
    my %h = header_map($rows->[$hi]); my @keys = sort { $h{$a} <=> $h{$b} } keys %h;
    for my $r (@{$rows}[$hi+1..$#$rows]) { my $wk = $r->[$h{Week}] // ''; next unless $wk =~ /^\s*(\d+)/; my $n=0+$1; my %rec;
      for my $k (@keys) { my $v=$r->[$h{$k}]; next unless defined $v && length $v; my $kk = lc $k; $kk =~ s/[^a-z0-9]+/_/g; $kk =~ s/^_|_$//g; $rec{$kk}=$v }
      my ($stdKey) = grep { /standards/i } @keys; $rec{standardsList} = [ expand_codes($stdKey ? ($r->[$h{$stdKey}]//'') : '') ];
      $out{$n}=\%rec }
    last;
  }
  return \%out;
}

# ---------------------------------------------------------------- video manifests
sub iframe_src { my $e=shift; return undef unless defined $e; return $e =~ /src=["']([^"']+)["']/ ? $1 : undef }
sub load_manifest {
  my ($repo)=@_; my $j = slurp("$CACHE/vm_$repo.json"); return {} unless $j;
  my $d = eval { JSON::PP->new->decode($j) }; return {} unless ref $d eq 'HASH'; my %m;
  if (ref $d->{videos} eq 'HASH') {
    for my $k (keys %{$d->{videos}}) { my $v=$d->{videos}{$k}; next unless ref $v eq 'HASH';
      $m{$k} = { status=>$v->{status}//'pending', type=>$v->{type}, section=>$v->{section}, file=>$v->{file}, embedSrc=>iframe_src($v->{embed}) } }
  } else {
    for my $k (keys %$d) { next if $k =~ /^_/; my $v=$d->{$k}; next unless ref $v eq 'HASH'; $m{$k} = { status=>$v->{status}//'pending', embedSrc=>iframe_src($v->{embed}) } }
  }
  return \%m;
}

# ---------------------------------------------------------------- classification
sub classify_item {
  my ($it)=@_; my $ct=$it->{contentType}//''; my $t=$it->{title}//'';
  return 'quiz'   if $ct eq 'Quizzes::Quiz';
  return 'header' if $ct eq 'ContextModuleSubHeader';
  return 'page'   if $ct eq 'WikiPage';
  return 'discussion' if $ct eq 'DiscussionTopic';
  return 'spotlight-vr' if $t =~ /spotlight/i;
  return 'fluency' if $t =~ /\bfluency\b/i;
  return 'practice' if $t =~ /goblins|independent practice|concept check|infinite mode/i;
  return 'assessment' if $t =~ /assessment|capstone|check-in|synthesis/i;
  return 'lesson';
}
sub lesson_code {
  my ($t)=@_; return $1 if $t =~ /\b(\d+\.\d{2}\.\d{2})\b/; return $1 if $t =~ /\b(\d{2}\.\d{2})\b/; return $1 if $t =~ /^(\d+-\d+):/; return undef;
}
sub video_keys_for {
  my ($course,$pageFile)=@_; my @k;
  if ($course->{videoKeyPrefix} && defined $pageFile) {
    if ($pageFile =~ /^lesson-(\d+)-(\d+|fluency)\b/) { push @k, "$course->{videoKeyPrefix}-$1-$2" }
    elsif ($pageFile =~ /^math-lesson-\d-(\d{2})-(\d{2})/) { push @k, "$course->{videoKeyPrefix}-$1-$2" }
  }
  return \@k;
}

# ---------------------------------------------------------------- main per-course build
my @catalog;
for my $c (@COURSES) {
  my $dir = "$EXPORTS/$c->{dir}"; unless (-d $dir) { warn "!! missing export folder $dir\n"; next }
  my $settings = course_settings($dir); my $mods = parse_modules($dir); my $pages = parse_wiki_pages($dir);
  my $manifest = load_manifest($c->{repo});
  my $xlsx = find_xlsx($dir);
  my $plan_tbl = ($c->{subject} eq 'social-studies' || $c->{subject} eq 'math') ? planning_table($xlsx, "$CACHE/xlsx/$c->{id}") : {};
  my $plan_ela = $c->{subject} eq 'ela' ? planning_ela($xlsx, "$CACHE/xlsx/$c->{id}") : {};
  my %pageById = map { ($_->{id}//'') => $_ } @$pages;
  my (%flAll, @outMods);
  my ($nLessons,$nQuizzes,$nAssess,$vReady,$vTotal,$missingPages) = (0,0,0,0,0,0);
  my %manifestByFile; for my $k (keys %$manifest) { my $f=$manifest->{$k}{file}; push @{$manifestByFile{$f}}, $k if $f }
  for my $m (@$mods) {
    my $week; my @items;
    for my $it (@{$m->{items}}) {
      my $kind = classify_item($it);
      my %o = ( id=>$it->{id}, ref=>$it->{ref}, title=>$it->{title}, kind=>$kind, canvasType=>$it->{contentType}, position=>$it->{position}, indent=>$it->{indent}, state=>$it->{state} );
      $week = 0+$1 if $kind eq 'header' && $it->{title} =~ /^Week\s+(\d+)/i;
      $o{week} = $week if defined $week;
      my $code = lesson_code($it->{title}); $o{code}=$code if $code;
      if ($code && $code =~ /^(\d+)-(\d+)$/) { $o{week} //= 0+$1; $o{day}=0+$2 }
      if ($code && $code =~ /^(\d+)\.(\d+)\.(\d+)$/) { $o{unit}=0+$2; $o{lessonNo}=0+$3 }
      if ($code && $code =~ /^(\d{2})\.(\d{2})$/) { $o{unit}=0+$1; $o{lessonNo}=0+$2 }
      if (($it->{contentType}//'') eq 'Assignment') {
        my $a = parse_assignment($dir,$it->{ref});
        if ($a) {
          $o{assignment} = { submissionTypes=>$a->{submissionTypes}, points=>$a->{points}, gradingType=>$a->{gradingType} };
          $o{pageUrl}=$a->{iframeSrc}; $o{pageFile}=$a->{pageFile}; $o{iframeHeight}=$a->{iframeHeight}; $o{extraHtml}=$a->{extraHtml} if $a->{extraHtml};
          $o{isPlaceholder} = JSON::PP::true if $it->{title} =~ /placeholder|template/i;
          if ($a->{pageFile}) {
            my $repo = $a->{repoFromSrc} // $c->{repo}; my $pf = "$PAGES/$repo/$a->{pageFile}";
            if (-f $pf) { my $L = parse_lesson_page(slurp($pf)); $L->{txNormalized} = [ uniq(map { normalize_tx($_, $c->{subject}, $c->{grade}) } @{$L->{txCodes}}) ]; $o{lesson}=$L; $flAll{$_}=1 for @{$L->{flCodes}}; $o{pageStatus}='ok' }
            else { $o{pageStatus}='missing'; $missingPages++ }
          }
          # videos: page slots + manifest status
          my @slots = @{ $o{lesson}{videoSlots} // [] }; my @keys = @{ video_keys_for($c,$a->{pageFile}) };
          push @keys, @{ $manifestByFile{$a->{pageFile}} // [] } if $a->{pageFile};
          my %bySlot; $bySlot{ $_->{slot} // '' } = $_ for @slots;
          for my $k (uniq(@keys)) { my $v=$manifest->{$k} or next;
            if ($bySlot{$k}) { $bySlot{$k}{status}=$v->{status}; $bySlot{$k}{embedSrc}=$v->{embedSrc} if $v->{embedSrc} }
            else { push @slots, { slot=>$k, type=>$v->{type}//'Lesson Video', title=>'', status=>$v->{status}, manifestKey=>JSON::PP::true, ($v->{embedSrc}?(embedSrc=>$v->{embedSrc}):()) } } }
          $_->{status} //= 'unassigned' for @slots;
          if (@slots) { my $r = grep { ($_->{status}//'') eq 'ready' } @slots; $o{videos} = { ready=>$r, total=>scalar(@slots), slots=>\@slots }; $vReady+=$r; $vTotal+=scalar(@slots) }
          $nLessons++ if $kind eq 'lesson' || $kind eq 'fluency'; $nAssess++ if $kind eq 'assessment';
          my $pcode = ($code && $code =~ /^\d{2}\.\d{2}$/) ? "$c->{grade}.$code" : $code;   # math titles say "Lesson 01.01"; the table says "4.01.01"
          if ($pcode && $plan_tbl->{$pcode}) { my %p=%{$plan_tbl->{$pcode}}; $o{planning}=\%p; $flAll{$_}=1 for @{$p{standardsList}||[]} }
          if (defined $o{week} && $plan_ela->{$o{week}}) { $o{planning}=$plan_ela->{$o{week}}; $flAll{$_}=1 for @{$plan_ela->{$o{week}}{standardsList}||[]} }
        }
      } elsif (($it->{contentType}//'') eq 'Quizzes::Quiz') {
        my $q = parse_quiz($dir,$it->{ref}); if ($q) { $o{quiz}=$q; $nQuizzes++; $o{questionCount}=scalar(@{$q->{questions}}); my %types; $types{$_->{type}}++ for @{$q->{questions}}; $o{questionTypes}=\%types }
      } elsif (($it->{contentType}//'') eq 'WikiPage') {
        my $p = $pageById{$it->{ref}//''}; $o{pageRef} = $p ? $p->{file} : undef;
      }
      push @items, \%o;
    }
    push @outMods, { id=>$m->{id}, title=>$m->{title}, position=>$m->{position}, state=>$m->{state}, items=>\@items,
      unitNo=>($m->{title} =~ /Unit\s+0?(\d+)/i ? 0+$1 : undef), bookTitle=>($m->{title} =~ /^(?:Unit|Book)\s+\d+:\s*(.+)$/i ? $1 : undef) };
  }
  my @fl = sort keys %flAll;
  my $course = {
    schema=>'ocs-course/1', generated=>$TODAY, id=>$c->{id}, title=>$settings->{title}, courseCode=>$settings->{courseCode}, canvasCourseId=>$settings->{canvasCourseId},
    grade=>$c->{grade}, subject=>$c->{subject}, subjectLabel=>$c->{subjectLabel}, rhythm=>$c->{rhythm}, accent=>$c->{accent},
    repo=>$c->{repo}, pagesBase=>"https://optimaondemand.github.io/$c->{repo}/", videoManifestUrl=>"https://raw.githubusercontent.com/optimaondemand/$c->{repo}/main/video-manifest.json",
    standardsBundle=>$c->{bundle}, sourceExport=>"$c->{dir}.imscc",
    modules=>\@outMods, pages=>$pages, resources=>list_resources($dir), flStandards=>\@fl,
    counts=>{ modules=>scalar(@outMods), lessons=>$nLessons, quizzes=>$nQuizzes, assessments=>$nAssess, pages=>scalar(@$pages), videosReady=>$vReady, videosTotal=>$vTotal, flStandards=>scalar(@fl), missingPages=>$missingPages },
    planningTable=>($xlsx ? basename($xlsx) : undef),
  };
  spew("$ROOT/data/courses/$c->{id}.json", $JSON->encode($course));
  push @catalog, { id=>$c->{id}, title=>$settings->{title}, shortTitle=>$c->{subjectLabel}, grade=>$c->{grade}, subject=>$c->{subject}, subjectLabel=>$c->{subjectLabel}, rhythm=>$c->{rhythm}, accent=>$c->{accent},
    repo=>$c->{repo}, pagesBase=>$course->{pagesBase}, videoManifestUrl=>$course->{videoManifestUrl}, standardsBundle=>$c->{bundle}, file=>"data/courses/$c->{id}.json", counts=>$course->{counts} };
  printf "%-20s modules=%2d lessons=%3d quizzes=%2d assess=%2d pages=%d videos=%d/%d FL=%d missingPages=%d planning=%s\n", $c->{id}, scalar(@outMods), $nLessons, $nQuizzes, $nAssess, scalar(@$pages), $vReady, $vTotal, scalar(@fl), $missingPages, ($xlsx ? 'yes' : 'no');
}

# ---------------------------------------------------------------- libraries (slim snapshots)
sub load_json { my $p=shift; my $s=slurp($p) or return undef; return eval { JSON::PP->new->decode($s) } }
my %libs;
if (my $art = load_json("$CACHE/art.json")) {
  my @w = map { { id=>$_->{id}, title=>$_->{title}, creator=>$_->{creator}, date=>$_->{date}, year=>$_->{year}, disposition=>$_->{disposition}, image=>$_->{image}, jstor=>$_->{jstor_url}, licence=>$_->{licence},
     courses=>$_->{courses}, units=>$_->{units}, material=>$_->{material}, tags=>[ map { { s=>$_->{scheme}, c=>$_->{code}, l=>$_->{label}, ($_->{discipline}?(d=>$_->{discipline}):()) } } @{$_->{tags}||[]} ] } } @{$art->{works}||[]};
  spew("$ROOT/data/libraries/art.json", $JSON->encode({ schema=>'ocs-art-slim/1', snapshot=>$TODAY, sourceGenerated=>$art->{generated}, live=>'https://optimaondemand.github.io/optima-widgets/optima-art/art.json',
     libraryPage=>'https://optimaondemand.github.io/optima-widgets/optima-art/art-reference-library.html', conceptVocabulary=>$art->{concept_vocabulary}, works=>\@w }));
  $libs{art} = { file=>'data/libraries/art.json', live=>'https://optimaondemand.github.io/optima-widgets/optima-art/art.json', page=>'https://optimaondemand.github.io/optima-widgets/optima-art/art-reference-library.html', count=>scalar(@w) };
}
if (my $mu = load_json("$CACHE/music.json")) {
  my @v = map { { id=>$_->{id}, title=>$_->{title}, channel=>$_->{channel}, embed=>$_->{embed_url}, url=>$_->{url}, thumb=>$_->{thumb}, state=>$_->{state}, disposition=>$_->{disposition}, courses=>$_->{courses},
     lessons=>[ map { { course=>$_->{course}, module=>$_->{module}, page=>$_->{page_title} } } @{$_->{lessons}||[]} ],
     tags=>[ map { { s=>$_->{scheme}, c=>$_->{code}, l=>$_->{label}, ($_->{discipline}?(d=>$_->{discipline}):()) } } @{$_->{tags}||[]} ], crossRefs=>$_->{cross_refs} } } @{$mu->{videos}||[]};
  spew("$ROOT/data/libraries/music.json", $JSON->encode({ schema=>'ocs-music-slim/1', snapshot=>$TODAY, sourceGenerated=>$mu->{generated}, live=>'https://optimaondemand.github.io/optima-widgets/optima-music/music.json',
     libraryPage=>'https://optimaondemand.github.io/optima-widgets/optima-music/music-reference-library.html', courses=>$mu->{courses}, labels=>$mu->{labels}, conceptVocabulary=>$mu->{concept_vocabulary}, videos=>\@v }));
  $libs{music} = { file=>'data/libraries/music.json', live=>'https://optimaondemand.github.io/optima-widgets/optima-music/music.json', page=>'https://optimaondemand.github.io/optima-widgets/optima-music/music-reference-library.html', count=>scalar(@v) };
}
if (my $lit = load_json("$CACHE/literature.json")) {
  my @t = map { { id=>$_->{id}, title=>$_->{title}, author=>$_->{author}, grade=>$_->{grade}, shelf=>$_->{shelf}, year=>($_->{first_published}{year}), listedAs=>$_->{listed_as},
     buyUrl=>$_->{buy}{url}, free=>{ state=>$_->{free}{state}, url=>$_->{free}{url}, source=>$_->{free}{source} }, taught=>$_->{taught}, translation=>$_->{flags}{translation}, verify=>$_->{flags}{verify} } } @{$lit->{titles}||[]};
  spew("$ROOT/data/libraries/literature.json", $JSON->encode({ schema=>'ocs-literature-slim/1', snapshot=>$TODAY, sourceGenerated=>$lit->{generated}, live=>'https://optimaondemand.github.io/optima-widgets/optima-literature/library.json',
     libraryPage=>'https://optimaondemand.github.io/optima-widgets/optima-literature/ela-reference-library.html', signposting=>$lit->{signposting}, titles=>\@t }));
  $libs{literature} = { file=>'data/libraries/literature.json', live=>'https://optimaondemand.github.io/optima-widgets/optima-literature/library.json', page=>'https://optimaondemand.github.io/optima-widgets/optima-literature/ela-reference-library.html', count=>scalar(@t) };
}

# ---------------------------------------------------------------- catalog
spew("$ROOT/data/catalog.json", $JSON->encode({
  schema=>'ocs-catalog/1', generated=>$TODAY, app=>{ name=>'Optima Curriculum Studio', repo=>'https://github.com/optimaondemand/Uber_Widget' },
  courses=>\@catalog, libraries=>\%libs,
  standards=>{ manifest=>{ file=>'data/standards/manifest.json', live=>'https://optimaondemand.github.io/optima-standards-browser/bundles-manifest.json' },
               bundles=>{ localBase=>'data/standards/', liveBase=>'https://optimaondemand.github.io/optima-standards-browser/bundles/' },
               browser=>'https://optimaondemand.github.io/optima-standards-browser/' },
  builders=>{ lessonPage=>'https://optimaondemand.github.io/teacher-homepages/lesson.html', courseHome=>'https://optimaondemand.github.io/teacher-homepages/#course', k2Lesson=>'https://bbirchum1.github.io/k-2-lesson-builder/', studyPlanner=>'https://optimaondemand.github.io/optima-widgets/study-planner.html' },
}));
print "catalog written: data/catalog.json (", scalar(@catalog), " courses)\n";
