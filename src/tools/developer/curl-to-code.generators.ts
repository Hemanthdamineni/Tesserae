/**
 * Per-language code generators for the curl-to-code tool. Each `gen*` renders
 * the shared `Request` model as equivalent code in one target language. Kept
 * separate from the parse model (`curl-to-code.core`) and the tool's run()
 * wiring so the generator table can live on its own.
 */

import type { Request } from './curl-to-code.core';
import {
  basename,
  buildMultipart,
  cLikeStr,
  goStr,
  jsStr,
  phpStr,
  psStr,
  pyStr,
  rubyStr,
  rustMethod,
  secondsText,
  textBody,
  getHeader,
  multipartFields,
  MULTIPART_BOUNDARY,
} from './curl-to-code.core';

function genFetch(request: Request): string {
  const lines: string[] = ['async function main() {'];
  const args: string[] = [`    method: ${jsStr(request.method)},`];

  if (request.headers.length) {
    lines.push('  const headers = {');
    for (const header of request.headers) {
      lines.push(`    ${jsStr(header.name)}: ${jsStr(header.value)},`);
    }
    lines.push('  };');
    args.push('    headers,');
  }

  const fields = multipartFields(request);
  if (fields.length) {
    lines.push('  const form = new FormData();');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(`  form.append(${jsStr(field.name)}, ${jsStr(field.value ?? '')});`);
      } else {
        lines.push(`  // TODO: provide a File/Blob for ${jsStr(field.file)}`);
        lines.push(
          `  form.append(${jsStr(field.name)}, new Blob([]), ${jsStr(field.filename ?? basename(field.file))});`,
        );
      }
    }
    args.push('    body: form,');
  } else if (request.body.kind === 'text') {
    args.push(`    body: ${jsStr(request.body.content)},`);
  } else if (request.body.kind === 'binary') {
    lines.push(`  // TODO: build the body from ${jsStr(request.body.file)}`);
    args.push('    body: new Blob([]),');
  }

  if (!request.followRedirects) args.push('    redirect: "manual",');

  lines.push(`  const res = await fetch(${jsStr(request.url)}, {`);
  for (const arg of args) lines.push(arg);
  lines.push('  });');
  lines.push('  if (!res.ok) throw new Error(`HTTP ${res.status}`);');
  lines.push('  console.log(await res.text());');
  lines.push('}');
  lines.push('');
  lines.push('main().catch(console.error);');
  return lines.join('\n');
}

function genAxios(request: Request): string {
  const inner: string[] = [];
  const args: string[] = [
    `  method: ${jsStr(request.method.toLowerCase())},`,
    `  url: ${jsStr(request.url)},`,
  ];

  const fields = multipartFields(request);
  if (fields.length) {
    inner.push('const form = new FormData();');
    for (const field of fields) {
      if (field.file === undefined) {
        inner.push(`form.append(${jsStr(field.name)}, ${jsStr(field.value ?? '')});`);
      } else {
        inner.push(`// TODO: provide a File/Blob/stream for ${jsStr(field.file)}`);
        inner.push(
          `form.append(${jsStr(field.name)}, new Blob([]), ${jsStr(field.filename ?? basename(field.file))});`,
        );
      }
    }
    inner.push('');
    args.push('  data: form,');
  } else if (request.body.kind === 'text') {
    args.push(`  data: ${jsStr(request.body.content)},`);
  } else if (request.body.kind === 'binary') {
    inner.push(`// TODO: build the body from ${jsStr(request.body.file)}`);
    args.push('  data: Buffer.alloc(0),');
  }

  if (request.headers.length) {
    inner.push('const headers = {');
    for (const header of request.headers) {
      inner.push(`  ${jsStr(header.name)}: ${jsStr(header.value)},`);
    }
    inner.push('};');
    inner.push('');
    args.push('  headers,');
  }

  if (!request.followRedirects) args.push('  maxRedirects: 0,');

  inner.push('const response = await axios({');
  for (const arg of args) inner.push(arg);
  inner.push('});');
  inner.push('console.log(response.data);');

  const lines: string[] = ['const axios = require("axios");', '', '(async () => {'];
  for (const line of inner) lines.push(line ? `  ${line}` : '');
  lines.push('})();');
  return lines.join('\n');
}

function genNode(request: Request): string {
  const mod = request.url.startsWith('https') ? 'https' : 'http';
  const lines: string[] = [`const ${mod} = require("${mod}");`];
  const fields = multipartFields(request);

  if (fields.length) {
    lines.push('const FormData = require("form-data");');
    lines.push('const fs = require("fs");');
  } else if (request.body.kind === 'binary') {
    lines.push('const fs = require("fs");');
  }

  lines.push('');
  lines.push('const options = {');
  lines.push(`  method: ${jsStr(request.method)},`);
  if (request.headers.length && !fields.length) {
    lines.push('  headers: {');
    for (const header of request.headers) {
      lines.push(`    ${jsStr(header.name)}: ${jsStr(header.value)},`);
    }
    lines.push('  },');
  }
  if (!request.followRedirects) {
    lines.push('  // curl does not follow redirects unless you pass -L.');
  }
  lines.push('};');
  lines.push('');

  if (fields.length) {
    lines.push('const form = new FormData();');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(`form.append(${jsStr(field.name)}, ${jsStr(field.value ?? '')});`);
      } else {
        const name = field.filename ?? basename(field.file);
        lines.push(
          `form.append(${jsStr(field.name)}, fs.createReadStream(${jsStr(field.file)}), ${jsStr(name)});`,
        );
      }
    }
    lines.push('options.headers = {');
    lines.push('  ...form.getHeaders(),');
    for (const header of request.headers) {
      lines.push(`  ${jsStr(header.name)}: ${jsStr(header.value)},`);
    }
    lines.push('};');
  } else if (request.body.kind === 'text') {
    lines.push(`const body = ${jsStr(request.body.content)};`);
  } else if (request.body.kind === 'binary') {
    lines.push(`const body = fs.readFileSync(${jsStr(request.body.file)});`);
  }

  lines.push('');
  lines.push(`const req = ${mod}.request(${jsStr(request.url)}, options, (res) => {`);
  lines.push('  let data = "";');
  lines.push('  res.on("data", (chunk) => (data += chunk));');
  lines.push('  res.on("end", () => console.log(data));');
  lines.push('});');
  lines.push('');
  lines.push('req.on("error", console.error);');
  if (fields.length) lines.push('form.pipe(req);');
  else {
    if (request.body.kind === 'text' || request.body.kind === 'binary')
      lines.push('req.write(body);');
    lines.push('req.end();');
  }
  return lines.join('\n');
}

function genPython(request: Request): string {
  const lines: string[] = ['import requests', ''];
  const args: string[] = [pyStr(request.method), pyStr(request.url)];
  const fields = multipartFields(request);

  if (request.headers.length) {
    lines.push('headers = {');
    for (const header of request.headers)
      lines.push(`    ${pyStr(header.name)}: ${pyStr(header.value)},`);
    lines.push('}');
    lines.push('');
    args.push('headers=headers');
  }

  if (fields.length) {
    const files = fields.filter((f) => f.file !== undefined);
    const data = fields.filter((f) => f.file === undefined);
    if (data.length) {
      lines.push('data = {');
      for (const field of data)
        lines.push(`    ${pyStr(field.name)}: ${pyStr(field.value ?? '')},`);
      lines.push('}');
      lines.push('');
      args.push('data=data');
    }
    lines.push('files = {');
    for (const field of files) {
      lines.push(`    ${pyStr(field.name)}: open(${pyStr(field.file ?? '')}, "rb"),`);
    }
    lines.push('}');
    lines.push('');
    if (files.length) args.push('files=files');
  } else if (request.body.kind === 'text') {
    lines.push(`data = ${pyStr(request.body.content)}`);
    lines.push('');
    args.push('data=data');
  } else if (request.body.kind === 'binary') {
    args.push(`data=open(${pyStr(request.body.file)}, "rb")`);
  }

  if (!request.followRedirects) args.push('allow_redirects=False');
  if (request.insecure) args.push('verify=False');
  if (request.proxy) {
    args.push(`proxies={"http": ${pyStr(request.proxy)}, "https": ${pyStr(request.proxy)}}`);
  }
  if (request.timeoutMs !== undefined) {
    args.push(`timeout=${secondsText(request.timeoutMs)}`);
  }

  lines.push(`response = requests.request(${args.join(', ')})`);
  lines.push('print(response.text)');
  return lines.join('\n');
}

function genGo(request: Request): string {
  const imports = new Set(['fmt', 'io', 'net/http']);
  const fields = multipartFields(request);

  if (fields.length) {
    imports.add('bytes');
    imports.add('mime/multipart');
    if (fields.some((f) => f.file !== undefined)) imports.add('os');
  } else if (request.body.kind === 'text') {
    imports.add('strings');
  } else if (request.body.kind === 'binary') {
    imports.add('os');
  }
  if (request.insecure) imports.add('crypto/tls');
  if (request.proxy) imports.add('net/url');
  if (request.timeoutMs !== undefined) imports.add('time');

  const lines: string[] = ['package main', '', 'import ('];
  for (const imp of [...imports].sort()) lines.push(`\t"${imp}"`);
  lines.push(')', '');
  lines.push('func main() {');

  if (fields.length) {
    lines.push('\tvar body bytes.Buffer');
    lines.push('\twriter := multipart.NewWriter(&body)');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(
          `\tif err := writer.WriteField(${goStr(field.name)}, ${goStr(field.value ?? '')}); err != nil {`,
        );
        lines.push('\t\tpanic(err)');
        lines.push('\t}');
      } else {
        const name = field.filename ?? basename(field.file);
        lines.push(`\tfile, err := os.Open(${goStr(field.file)})`);
        lines.push('\tif err != nil {');
        lines.push('\t\tpanic(err)');
        lines.push('\t}');
        lines.push('\tdefer file.Close()');
        lines.push(`\tpart, err := writer.CreateFormFile(${goStr(field.name)}, ${goStr(name)})`);
        lines.push('\tif err != nil {');
        lines.push('\t\tpanic(err)');
        lines.push('\t}');
        lines.push('\tif _, err := io.Copy(part, file); err != nil {');
        lines.push('\t\tpanic(err)');
        lines.push('\t}');
      }
    }
    lines.push('\tif err := writer.Close(); err != nil {');
    lines.push('\t\tpanic(err)');
    lines.push('\t}');
  }

  const bodyExpr =
    fields.length || request.body.kind === 'none'
      ? 'nil'
      : request.body.kind === 'text'
        ? 'strings.NewReader(body)'
        : 'file';

  if (request.body.kind === 'text' && !fields.length) {
    lines.push(`\tbody := ${goStr(request.body.content)}`);
  }
  if (request.body.kind === 'binary') {
    lines.push(`\tfile, err := os.Open(${goStr(request.body.file)})`);
    lines.push('\tif err != nil {');
    lines.push('\t\tpanic(err)');
    lines.push('\t}');
    lines.push('\tdefer file.Close()');
  }

  const reader = fields.length ? '&body' : bodyExpr;
  lines.push(
    `\treq, err := http.NewRequest(${goStr(request.method)}, ${goStr(request.url)}, ${reader})`,
  );
  lines.push('\tif err != nil {');
  lines.push('\t\tpanic(err)');
  lines.push('\t}');
  for (const header of request.headers) {
    lines.push(`\treq.Header.Set(${goStr(header.name)}, ${goStr(header.value)})`);
  }
  if (fields.length) lines.push('\treq.Header.Set("Content-Type", writer.FormDataContentType())');

  const clientBodies: string[] = [];
  if (request.timeoutMs !== undefined)
    clientBodies.push(`\t\tTimeout: ${secondsText(request.timeoutMs)} * time.Second,`);
  const transport: string[] = [];
  if (request.insecure)
    transport.push('\t\t\tTLSClientConfig: &tls.Config{InsecureSkipVerify: true},');
  if (request.proxy) {
    transport.push('\t\t\tProxy: http.ProxyURL(proxyURL),');
  }
  if (transport.length) {
    clientBodies.push('\t\tTransport: &http.Transport{');
    if (request.proxy) {
      lines.push('');
      lines.push(`\tproxyURL, err := url.Parse(${goStr(request.proxy)})`);
      lines.push('\tif err != nil {');
      lines.push('\t\tpanic(err)');
      lines.push('\t}');
    }
    for (const line of transport) clientBodies.push(line);
    clientBodies.push('\t\t},');
  }

  lines.push('');
  if (clientBodies.length) {
    lines.push('\tclient := &http.Client{');
    for (const line of clientBodies) lines.push(line);
    lines.push('\t}');
  } else {
    lines.push('\tclient := http.DefaultClient');
  }
  lines.push('');
  lines.push('\tresp, err := client.Do(req)');
  lines.push('\tif err != nil {');
  lines.push('\t\tpanic(err)');
  lines.push('\t}');
  lines.push('\tdefer resp.Body.Close()');
  lines.push('');
  lines.push('\trespBody, err := io.ReadAll(resp.Body)');
  lines.push('\tif err != nil {');
  lines.push('\t\tpanic(err)');
  lines.push('\t}');
  lines.push('');
  lines.push('\tfmt.Println(string(respBody))');
  lines.push('}');
  return lines.join('\n');
}

function genPhp(request: Request): string {
  const lines: string[] = ['<?php', '$ch = curl_init();'];
  lines.push(`curl_setopt($ch, CURLOPT_URL, ${phpStr(request.url)});`);
  lines.push('curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);');
  lines.push(`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpStr(request.method)});`);

  const fields = multipartFields(request);
  if (request.headers.length) {
    lines.push('curl_setopt($ch, CURLOPT_HTTPHEADER, [');
    for (const header of request.headers) {
      lines.push(`    ${phpStr(`${header.name}: ${header.value}`)},`);
    }
    lines.push(']);');
  }

  if (fields.length) {
    lines.push('curl_setopt($ch, CURLOPT_POSTFIELDS, [');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(`    ${phpStr(field.name)} => ${phpStr(field.value ?? '')},`);
      } else {
        const name = field.filename ?? basename(field.file);
        lines.push(
          `    ${phpStr(field.name)} => new CURLFile(${phpStr(field.file)}, '', ${phpStr(name)}),`,
        );
      }
    }
    lines.push(']);');
  } else if (request.body.kind === 'text') {
    lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpStr(request.body.content)});`);
  } else if (request.body.kind === 'binary') {
    lines.push(
      `curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents(${phpStr(request.body.file)}));`,
    );
  }

  if (request.followRedirects) lines.push('curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);');
  if (request.insecure) {
    lines.push('curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);');
    lines.push('curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);');
  }
  if (request.proxy) lines.push(`curl_setopt($ch, CURLOPT_PROXY, ${phpStr(request.proxy)});`);
  if (request.timeoutMs !== undefined) {
    lines.push(`curl_setopt($ch, CURLOPT_TIMEOUT, ${Math.round(request.timeoutMs / 1000)});`);
  }

  lines.push('$response = curl_exec($ch);');
  lines.push('curl_close($ch);');
  lines.push('echo $response;');
  return lines.join('\n');
}

const RUBY_METHODS: Record<string, string> = {
  GET: 'Get',
  POST: 'Post',
  PUT: 'Put',
  PATCH: 'Patch',
  DELETE: 'Delete',
  HEAD: 'Head',
  OPTIONS: 'Options',
};

function genRuby(request: Request): string {
  const lines: string[] = ['require "net/http"', 'require "uri"'];
  if (request.insecure) lines.push('require "openssl"');
  lines.push('');
  lines.push(`uri = URI.parse(${rubyStr(request.url)})`);

  const proxy = request.proxy
    ? (() => {
        try {
          const parsed = new URL(request.proxy);
          return `, ${rubyStr(parsed.hostname)}, ${parsed.port || (parsed.protocol === 'https:' ? 443 : 80)}`;
        } catch {
          return '';
        }
      })()
    : '';
  lines.push(`http = Net::HTTP.new(uri.host, uri.port${proxy})`);
  lines.push('http.use_ssl = (uri.scheme == "https")');
  if (request.insecure) lines.push('http.verify_mode = OpenSSL::SSL::VERIFY_NONE');
  if (request.timeoutMs !== undefined) {
    lines.push(`http.read_timeout = ${Math.round(request.timeoutMs / 1000)}`);
  }
  lines.push('');

  const methodClass = RUBY_METHODS[request.method];
  if (methodClass) {
    lines.push(`request = Net::HTTP::${methodClass}.new(uri)`);
  } else {
    lines.push(
      `request = Net::HTTPGenericRequest.new(${rubyStr(request.method)}, true, true, uri)`,
    );
  }

  for (const header of request.headers) {
    lines.push(`request[${rubyStr(header.name)}] = ${rubyStr(header.value)}`);
  }

  const fields = multipartFields(request);
  if (fields.length) {
    lines.push('request.set_form([');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(`  [${rubyStr(field.name)}, ${rubyStr(field.value ?? '')}],`);
      } else {
        lines.push(`  [${rubyStr(field.name)}, File.open(${rubyStr(field.file)})],`);
      }
    }
    lines.push("], 'multipart/form-data')");
  } else if (request.body.kind === 'text') {
    lines.push(`request.body = ${rubyStr(request.body.content)}`);
  } else if (request.body.kind === 'binary') {
    lines.push(`request.body = File.read(${rubyStr(request.body.file)})`);
  }

  lines.push('');
  lines.push('response = http.request(request)');
  lines.push('puts response.body');
  return lines.join('\n');
}

function genJava(request: Request): string {
  const lines: string[] = [
    'import java.net.URI;',
    'import java.net.http.HttpClient;',
    'import java.net.http.HttpRequest;',
    'import java.net.http.HttpResponse;',
    '',
    'public class Main {',
    '    public static void main(String[] args) throws Exception {',
    '        HttpClient client = HttpClient.newHttpClient();',
  ];

  const fields = multipartFields(request);
  const isText = request.body.kind === 'text';
  const boundary = MULTIPART_BOUNDARY;
  let bodyExpr = 'HttpRequest.BodyPublishers.noBody()';

  if (fields.length) {
    const multipart = buildMultipart(boundary, fields);
    lines.push(`        String multipart = ${cLikeStr(multipart)};`);
    bodyExpr = 'HttpRequest.BodyPublishers.ofString(multipart)';
  } else if (isText) {
    bodyExpr = `HttpRequest.BodyPublishers.ofString(${cLikeStr(textBody(request))})`;
  } else if (request.body.kind === 'binary') {
    lines.push('        // TODO: replace with the real file bytes');
    bodyExpr = `HttpRequest.BodyPublishers.ofByteArray(java.nio.file.Files.readAllBytes(java.nio.file.Path.of(${cLikeStr(request.body.file)})))`;
  }

  lines.push('        HttpRequest request = HttpRequest.newBuilder()');
  lines.push(`            .uri(URI.create(${cLikeStr(request.url)}))`);
  for (const header of request.headers) {
    if (fields.length && header.name.toLowerCase() === 'content-type') continue;
    lines.push(`            .header(${cLikeStr(header.name)}, ${cLikeStr(header.value)})`);
  }
  if (fields.length) {
    lines.push(`            .header("Content-Type", "multipart/form-data; boundary=${boundary}")`);
  }
  lines.push(`            .method(${cLikeStr(request.method)}, ${bodyExpr})`);
  lines.push('            .build();');
  lines.push('');
  lines.push(
    '        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());',
  );
  lines.push('        System.out.println(response.body());');
  lines.push('    }');
  lines.push('}');
  return lines.join('\n');
}

function genCsharp(request: Request): string {
  const lines: string[] = ['using System;', 'using System.Net.Http;'];
  if (request.body.kind === 'text') lines.push('using System.Text;');
  const fields = multipartFields(request);
  if (fields.some((f) => f.file !== undefined) || request.body.kind === 'binary') {
    lines.push('using System.IO;');
  }
  lines.push(
    'using System.Threading.Tasks;',
    '',
    'class Program',
    '{',
    '    static async Task Main()',
    '    {',
  );
  lines.push('        using var client = new HttpClient();');
  lines.push(
    `        var request = new HttpRequestMessage(new HttpMethod(${cLikeStr(request.method)}), ${cLikeStr(request.url)});`,
  );

  const contentType = getHeader(request, 'content-type');
  const otherHeaders = request.headers.filter((h) => h.name.toLowerCase() !== 'content-type');
  for (const header of otherHeaders) {
    lines.push(
      `        request.Headers.TryAddWithoutValidation(${cLikeStr(header.name)}, ${cLikeStr(header.value)});`,
    );
  }

  if (fields.length) {
    lines.push('        var content = new MultipartFormDataContent();');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(
          `        content.Add(new StringContent(${cLikeStr(field.value ?? '')}), ${cLikeStr(field.name)});`,
        );
      } else {
        const name = field.filename ?? basename(field.file);
        lines.push(
          `        content.Add(new ByteArrayContent(File.ReadAllBytes(${cLikeStr(field.file)})), ${cLikeStr(field.name)}, ${cLikeStr(name)});`,
        );
      }
    }
    lines.push('        request.Content = content;');
  } else if (request.body.kind === 'text') {
    const mediaType = contentType ?? 'text/plain';
    lines.push(
      `        request.Content = new StringContent(${cLikeStr(request.body.content)}, Encoding.UTF8, ${cLikeStr(mediaType)});`,
    );
  } else if (request.body.kind === 'binary') {
    lines.push(
      `        request.Content = new ByteArrayContent(File.ReadAllBytes(${cLikeStr(request.body.file)}));`,
    );
  }

  lines.push('');
  lines.push('        var response = await client.SendAsync(request);');
  lines.push('        Console.WriteLine(await response.Content.ReadAsStringAsync());');
  lines.push('    }');
  lines.push('}');
  return lines.join('\n');
}

function genRust(request: Request): string {
  const lines: string[] = [
    '#[tokio::main]',
    'async fn main() -> Result<(), Box<dyn std::error::Error>> {',
  ];
  const clientBodies: string[] = [];
  if (request.insecure) clientBodies.push('        .danger_accept_invalid_certs(true)');
  if (request.proxy) {
    lines.push(`    let proxy = reqwest::Proxy::all(${cLikeStr(request.proxy)})?;`);
    clientBodies.push('        .proxy(proxy)');
  }
  if (request.timeoutMs !== undefined) {
    lines.push('    use std::time::Duration;');
    clientBodies.push(`        .timeout(Duration::from_millis(${request.timeoutMs}))`);
  }

  if (clientBodies.length) {
    lines.push('    let client = reqwest::Client::builder()');
    for (const body of clientBodies) lines.push(body);
    lines.push('        .build()?;');
  } else {
    lines.push('    let client = reqwest::Client::new();');
  }

  lines.push('    let res = client');
  lines.push(`        .request(${rustMethod(request.method)}, ${cLikeStr(request.url)})`);
  for (const header of request.headers) {
    lines.push(`        .header(${cLikeStr(header.name)}, ${cLikeStr(header.value)})`);
  }

  const fields = multipartFields(request);
  if (fields.length) {
    lines.push('        .multipart(');
    lines.push('            reqwest::multipart::Form::new()');
    for (const field of fields) {
      if (field.file === undefined) {
        lines.push(
          `                .text(${cLikeStr(field.name)}, ${cLikeStr(field.value ?? '')})`,
        );
      } else {
        lines.push(`                .file(${cLikeStr(field.name)}, ${cLikeStr(field.file)})`);
      }
    }
    lines.push('        )');
  } else if (request.body.kind === 'text') {
    lines.push(`        .body(${cLikeStr(request.body.content)})`);
  } else if (request.body.kind === 'binary') {
    lines.push('        // TODO: stream the file body, e.g. tokio::fs::read');
  }

  lines.push('        .send()');
  lines.push('        .await?;');
  lines.push('    println!("{}", res.text().await?);');
  lines.push('    Ok(())');
  lines.push('}');
  return lines.join('\n');
}

function genPowerShell(request: Request): string {
  const lines: string[] = [];
  if (request.headers.length) {
    lines.push('$headers = @{');
    for (const header of request.headers) {
      lines.push(`    ${psStr(header.name)} = ${psStr(header.value)}`);
    }
    lines.push('}');
    lines.push('');
  }

  const fields = multipartFields(request);
  const args: string[] = [`-Uri ${psStr(request.url)}`, `-Method ${psStr(request.method)}`];
  if (request.headers.length) args.push('-Headers $headers');

  if (fields.length) {
    lines.push('$form = @{');
    for (const field of fields) {
      if (field.file === undefined)
        lines.push(`    ${psStr(field.name)} = ${psStr(field.value ?? '')}`);
      else lines.push(`    ${psStr(field.name)} = Get-Item ${psStr(field.file)} -ErrorAction Stop`);
    }
    lines.push('}');
    lines.push('');
    args.push('-Form $form');
  } else if (request.body.kind === 'text') {
    args.push(`-Body ${psStr(request.body.content)}`);
  } else if (request.body.kind === 'binary') {
    args.push(`-InFile ${psStr(request.body.file)}`);
  }

  if (!request.followRedirects) args.push('-MaximumRedirection 0');
  if (request.insecure) args.push('-SkipCertificateCheck');
  if (request.proxy) args.push(`-Proxy ${psStr(request.proxy)}`);
  if (request.timeoutMs !== undefined)
    args.push(`-TimeoutSec ${Math.round(request.timeoutMs / 1000)}`);

  lines.push(`$response = Invoke-RestMethod ${args.join(' `\n    ')}`);
  lines.push('$response');
  return lines.join('\n');
}

function genHttp(request: Request): string {
  let host = '';
  let path = '/';
  try {
    const parsed = new URL(request.url);
    host = parsed.host;
    path = `${parsed.pathname || '/'}${parsed.search}`;
  } catch {
    host = '';
  }

  const fields = multipartFields(request);
  const lines: string[] = [`${request.method} ${path} HTTP/1.1`];
  if (host && !getHeader(request, 'host')) lines.push(`Host: ${host}`);
  for (const header of request.headers) {
    if (header.name.toLowerCase() === 'host') continue;
    lines.push(`${header.name}: ${header.value}`);
  }
  if (fields.length && !getHeader(request, 'content-type')) {
    lines.push(`Content-Type: multipart/form-data; boundary=${MULTIPART_BOUNDARY}`);
  }

  let body = '';
  if (fields.length) body = buildMultipart(MULTIPART_BOUNDARY, fields);
  else if (request.body.kind === 'text') body = textBody(request);
  else if (request.body.kind === 'binary') body = `<contents of ${request.body.file}>`;

  lines.push('');
  lines.push(body);
  return lines.join('\n');
}

export const GENERATORS: Record<string, (request: Request) => string> = {
  fetch: genFetch,
  axios: genAxios,
  node: genNode,
  python: genPython,
  go: genGo,
  php: genPhp,
  ruby: genRuby,
  java: genJava,
  csharp: genCsharp,
  rust: genRust,
  powershell: genPowerShell,
  http: genHttp,
};

export const LANGUAGES: Record<string, string> = {
  fetch: 'javascript',
  axios: 'javascript',
  node: 'javascript',
  python: 'python',
  go: 'go',
  php: 'php',
  ruby: 'ruby',
  java: 'java',
  csharp: 'csharp',
  rust: 'rust',
  powershell: 'powershell',
  http: 'http',
};
