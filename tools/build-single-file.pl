#!/usr/bin/env perl
# =====================================================================
#  Optima Curriculum Studio - single-file preview build
#  Inlines the stylesheet, every script, every data file, and the logo
#  into ONE HTML file so the studio can be shared as a hosted preview
#  (for example a Claude artifact) where nothing may be fetched.
#
#    perl tools/build-single-file.pl [output.html] [--fragment]
#
#  --fragment omits <!DOCTYPE>/<html>/<head>/<body> wrappers (the artifact
#  host adds its own); without it you get a complete standalone page.
# =====================================================================
use strict; use warnings; use utf8;
use File::Basename qw(dirname);
use File::Find qw(find);
use Cwd qw(abs_path);
use MIME::Base64 qw(encode_base64);

my $ROOT = dirname(dirname(abs_path(__FILE__)));
my ($out, $fragment) = ('optima-curriculum-studio.html', 0);
for (@ARGV) { if ($_ eq '--fragment') { $fragment = 1 } else { $out = $_ } }

sub slurp { my ($p)=@_; open(my $fh,'<:raw',$p) or die "read $p: $!"; local $/; my $s=<$fh>; close $fh; utf8::decode($s); return $s }
sub slurp_raw { my ($p)=@_; open(my $fh,'<:raw',$p) or die "read $p: $!"; local $/; my $s=<$fh>; close $fh; return $s }

my $index = slurp("$ROOT/index.html");
my ($body) = $index =~ /<body>(.*)<\/body>/s or die "no <body> in index.html";
my @scripts = $body =~ /<script src="([^"]+)"><\/script>/g;
$body =~ s/\s*<script src="[^"]+"><\/script>//g;
$body =~ s/^\s+|\s+$//g;

# logo as a data URI so it survives a strict CSP
my $logoUrl = 'https://raw.githubusercontent.com/optimaondemand/optima-assets/eeb0b335630058906d52f478028361d352253a93/images/Optima%20Final%20Circle%20-%20Owl%20Only.png';
my $logoFile = $ENV{OCS_LOGO} || "$ROOT/tools/.cache/owl.png";
if (-f $logoFile) { my $b64 = encode_base64(slurp_raw($logoFile), ''); $body =~ s/\Q$logoUrl\E/data:image\/png;base64,$b64/g; }

my $css = slurp("$ROOT/assets/css/studio.css");
my ($fontImport) = $css =~ /\@import url\('([^']+)'\);/; $css =~ s/\@import url\('[^']+'\);\s*//;

# every JSON under data/ ships inside the page
my %embed; find({ no_chdir=>1, wanted=>sub { return unless -f $_ && /\.json$/; my $rel=$_; $rel =~ s/^\Q$ROOT\E\/?//; $embed{$rel} = slurp($_) } }, "$ROOT/data");
my $embedJs = "window.OCS_EMBED = {\n" . join(",\n", map { my $j=$embed{$_}; $j =~ s{</}{<\\/}g; "\"$_\": $j" } sort keys %embed) . "\n};";

my @parts;
push @parts, "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" unless $fragment;
push @parts, "<title>Optima Curriculum Studio</title>";
push @parts, "<link rel=\"stylesheet\" href=\"$fontImport\">" if $fontImport;
push @parts, "<style>\n$css\n</style>";
push @parts, "</head>\n<body>" unless $fragment;
push @parts, $body;
for my $s (@scripts) {
  if ($s =~ /^https?:/) { push @parts, "<script src=\"$s\"></script>"; next }
  push @parts, "<script>\n$embedJs\n</script>" if $s =~ m{assets/js/data\.js$} && $embedJs;   # data must exist before data.js runs
  my $js = slurp("$ROOT/$s"); $js =~ s{</script}{<\\/script}g;
  push @parts, "<script>\n/* $s */\n$js\n</script>";
}
push @parts, "</body>\n</html>" unless $fragment;

my $html = join("\n", @parts);
open(my $fh, '>:raw', $out) or die "write $out: $!"; print $fh do { my $h=$html; utf8::encode($h); $h }; close $fh;
printf "wrote %s (%.1f MB, %d data files, %d scripts)\n", $out, (-s $out)/1048576, scalar(keys %embed), scalar(@scripts);
