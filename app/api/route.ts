import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { NextRequest, NextResponse } from 'next/server'
import { cleanInput } from '../../lib/utils'
import { whisper } from '../../services/openai'

export async function POST(req: NextRequest) {
  const form = await req.formData()

  const blob = form.get('file') as Blob | null
  const name = cleanInput(form.get('name') as string)
  const datetime = cleanInput(form.get('datetime') as string)
  const raw_options = cleanInput(form.get('options') as string)

  if (!blob || !name || !datetime) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const options = JSON.parse(raw_options)
  const buffer = Buffer.from(await blob.arrayBuffer())
  const filename = `${name}.webm`
  let filepath = path.join('public', 'uploads', filename)

  fs.writeFileSync(filepath, buffer)

  let outFile = path.join('public', 'uploads', `out-${filename}`)
  const retval: any = await new Promise((resolve) => {
    const sCommand = `ffmpeg -i ${filepath} -af silenceremove=stop_periods=-1:stop_duration=1:stop_threshold=-50dB ${outFile}`

    exec(sCommand, (error, stdout, stderr) => {
      if (error) {
        resolve({ status: 'error' })
      } else {
        resolve({ status: 'success', error: stderr, out: stdout })
      }
    })
  })

  if (retval.status === 'success') {
    filepath = outFile
  }

  const minFileSize = 18000
  const stats = fs.statSync(outFile)

  if (parseInt(stats.size.toString()) < minFileSize) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const flagDoNotUseApi = process?.env?.DO_NOT_USE_API === 'true'

  if (flagDoNotUseApi) {
    const outputDir = path.join('public', 'uploads')
    let sCommand = `whisper './${filepath}' --language ${options.language} --temperature ${options.temperature} --model tiny --output_dir '${outputDir}'`
    if (options.endpoint === 'translations') {
      sCommand = `whisper './${filepath}' --language ${options.language} --task translate --temperature ${options.temperature} --model tiny --output_dir '${outputDir}'`
    }

    const retval: any = await new Promise((resolve) => {
      exec(sCommand, (error, stdout, stderr) => {
        if (error) {
          resolve({ status: 'error', message: 'Failed to transcribe [1]' })
        } else {
          resolve({ status: 'ok', error: stderr, out: stdout })
        }
      })
    })

    if (retval.status === 'error' || retval.out.length === 0) {
      return new NextResponse('Bad Request', { status: 400 })
    }

    let sout: string[] = []
    const stokens = retval.out.split('\n')
    for (let i = 0; i < stokens.length; i++) {
      const n = stokens[i].indexOf(']')
      if (n > 0) {
        const s1 = stokens[i].substring(0, n + 1)
        const s2 = stokens[i].substring(n + 1)
        sout.push(s1)
        sout.push(s2)
      } else {
        sout.push(stokens[i])
      }
    }

    return NextResponse.json({
      datetime,
      filename,
      data: sout.join('\n'),
    })
  }

  console.log('using whisper api...', filename)

  let data = ''

  try {
    if (!process?.env?.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY missing in environment')
    }

    const result: any = await whisper({
      mode: options.endpoint,
      file: fs.createReadStream(filepath),
      response_format: 'vtt',
      temperature: options.temperature,
      language: options.language,
    })

    if (typeof result === 'string') {
      data = result
    } else if ('text' in result) {
      data = result.text
    } else if ('data' in result) {
      data = result.data
    } else {
      data = JSON.stringify(result)
    }

    console.log(options.endpoint, data)
  } catch (error: any) {
    console.error(error.name, error.message)
    return new NextResponse('Error during transcription', { status: 500 })
  }

  return NextResponse.json({
    datetime,
    filename,
    data,
  })
}
